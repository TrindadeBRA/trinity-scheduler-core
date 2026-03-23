# Bugfix Requirements Document

## Introduction

O fluxo de recuperação de senha está aproximadamente 30% implementado. O backend gera o token de reset no banco mas não envia o email com o link. O endpoint `POST /admin/auth/reset-password` não existe, tornando o token inutilizável. No frontend, `ForgotPassword.tsx` simula o envio com um `setTimeout` sem chamar nenhuma API, e a página `ResetPassword` não existe nem está roteada. O resultado é que um usuário que esqueceu a senha não consegue recuperá-la de forma alguma.

## Bug Analysis

### Current Behavior (Defect)

1.1 QUANDO o usuário submete o formulário de "Esqueci minha senha" com um email válido ENTÃO o sistema exibe "Email enviado!" após 800ms sem chamar nenhuma API

1.2 QUANDO o backend recebe `POST /admin/auth/forgot-password` com um email cadastrado ENTÃO o sistema salva `resetToken` e `resetTokenExp` no banco mas não envia nenhum email ao usuário

1.3 QUANDO o usuário tenta acessar `/reset-password?token=<token>` para redefinir a senha ENTÃO o sistema exibe a página 404 pois a rota não existe no frontend

1.4 QUANDO qualquer cliente tenta consumir o token de reset via API ENTÃO o sistema retorna 404 pois o endpoint `POST /admin/auth/reset-password` não existe no backend

### Expected Behavior (Correct)

2.1 QUANDO o usuário submete o formulário de "Esqueci minha senha" com um email válido ENTÃO o sistema SHALL chamar `POST /admin/auth/forgot-password` e exibir a mensagem de confirmação somente após a resposta da API

2.2 QUANDO o backend recebe `POST /admin/auth/forgot-password` com um email cadastrado ENTÃO o sistema SHALL salvar o token no banco E enviar um email ao usuário contendo o link `<FRONTEND_URL>/reset-password?token=<resetToken>`

2.3 QUANDO o usuário acessa `/reset-password?token=<token>` ENTÃO o sistema SHALL exibir um formulário para definir a nova senha

2.4 QUANDO o usuário submete o formulário de nova senha com um token válido e não expirado ENTÃO o sistema SHALL chamar `POST /admin/auth/reset-password`, atualizar a senha no banco, invalidar o token e redirecionar para o login

2.5 QUANDO o backend recebe `POST /admin/auth/reset-password` com token válido, não expirado e nova senha que atende os requisitos ENTÃO o sistema SHALL atualizar o `passwordHash` do usuário e limpar `resetToken` e `resetTokenExp`

### Unchanged Behavior (Regression Prevention)

3.1 QUANDO o usuário submete o formulário de "Esqueci minha senha" com um email NÃO cadastrado ENTÃO o sistema SHALL CONTINUE TO retornar 200 com a mensagem genérica, sem vazar informação sobre emails cadastrados

3.2 QUANDO o usuário faz login com email e senha válidos ENTÃO o sistema SHALL CONTINUE TO autenticar normalmente e retornar o JWT

3.3 QUANDO o usuário faz login com credenciais inválidas ENTÃO o sistema SHALL CONTINUE TO retornar 401 com a mensagem de erro adequada

3.4 QUANDO o backend recebe `POST /admin/auth/reset-password` com um token expirado ENTÃO o sistema SHALL CONTINUE TO rejeitar a requisição com erro de validação

3.5 QUANDO o backend recebe `POST /admin/auth/reset-password` com uma senha que não atende os requisitos de complexidade ENTÃO o sistema SHALL CONTINUE TO rejeitar com erro de validação
