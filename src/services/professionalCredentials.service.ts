import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../utils/errors';
import { User } from '@prisma/client';

export interface CreateCredentialsInput {
  professionalId: string;
  shopId: string;
  name: string;
  email: string;
  password: string;
}

export interface UpdateCredentialsInput {
  professionalId: string;
  email?: string;
  password?: string;
}

/**
 * Create professional credentials (User record) linked to a Professional
 * @throws AppError with 409 CONFLICT if email already exists
 */
export async function createProfessionalCredentials(
  input: CreateCredentialsInput
): Promise<User> {
  const { professionalId, shopId, name, email, password } = input;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError(409, 'CONFLICT', 'Email já está em uso');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create User with role='professional'
  const user = await prisma.user.create({
    data: {
      shopId,
      name,
      email,
      passwordHash,
      role: 'professional',
      professionalId,
    },
  });

  return user;
}

/**
 * Update professional credentials (email and/or password)
 * @throws AppError with 409 CONFLICT if email already exists for a different user
 * @throws AppError with 404 NOT_FOUND if user not found
 */
export async function updateProfessionalCredentials(
  input: UpdateCredentialsInput
): Promise<User> {
  const { professionalId, email, password } = input;

  // Get existing user
  const existingUser = await prisma.user.findUnique({
    where: { professionalId },
  });

  if (!existingUser) {
    throw new AppError(404, 'NOT_FOUND', 'Usuário não encontrado para este profissional');
  }

  // If email is being updated, check uniqueness
  if (email && email !== existingUser.email) {
    const emailInUse = await prisma.user.findUnique({
      where: { email },
    });

    if (emailInUse) {
      throw new AppError(409, 'CONFLICT', 'Email já está em uso');
    }
  }

  // Prepare update data
  const updateData: { email?: string; passwordHash?: string } = {};
  
  if (email) {
    updateData.email = email;
  }
  
  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { professionalId },
    data: updateData,
  });

  return updatedUser;
}

/**
 * Get User record by professionalId
 * @returns User or null if not found
 */
export async function getProfessionalUser(
  professionalId: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { professionalId },
  });

  return user;
}
