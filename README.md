# Stans

Rede social para fandoms (anime, k-pop, séries, games, música, esportes, times e jogadores). Os usuários são chamados de **fãs**.

## O que já está pronto

**Servidor (`server/`, Node + Express 5 + Socket.IO + PostgreSQL, em TypeScript)**
- Cadastro e login com JWT, limite de tentativas nas rotas de auth
- Comunidades com categoria, papéis (member/mod/owner) e sala de chat por comunidade
- Posts com tag de spoiler e hashtags, feed com paginação por cursor, curtidas e comentários
- Mural de recados (com respostas, política "todos" ou "quem eu sigo", dono pode apagar)
- Avaliações de fã: Superfan, Cool, Hot e Boring, 1 voto por semana por perfil, anônimas, com opção de ocultar
- Status: presença (online/offline, modo invisível) e status personalizado com expiração
- Chat em tempo real: comunidade e privado, histórico paginado, "digitando...", não lidas, limite de envio

**App (`mobile/src/`)**: tema (paleta e degradê), configuração dos botões de avaliação e o componente `RatingButtons`.

## Como rodar

```bash
docker compose up -d                      # Postgres com o schema já aplicado
cd server && cp .env.example .env         # troque o JWT_SECRET
npm install && npm run dev                # API em http://localhost:3000
```

App: crie o projeto Expo e copie a pasta `src/`:
```bash
npx create-expo-app@latest mobile-app -t expo-template-blank-typescript
```

## Decisões que ficam em aberto
- **Hot × Fire:** se o app puder ter menores de idade, troque o rótulo para "Fire" em `mobile/src/ratings.ts`.
- **Contas novas** (menos de 24h) não podem avaliar. Falta confirmação de e-mail.

## Créditos
Ícones por Magnific / Flaticon (https://www.flaticon.com). Atribuição obrigatória no plano gratuito. Adicione os links dos ícones usados ao baixá-los.

## Próximos passos
Telas do app, upload de imagens (Supabase Storage), denúncias, Redis (presença e pub/sub com várias instâncias), salas de evento, testes e GitHub Actions.
