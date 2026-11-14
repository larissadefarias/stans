# Colocar o Stans no ar (de graça)

| Parte | Onde | Plano |
|---|---|---|
| Banco | **Neon** (o mesmo que você já usa) | Free |
| Fotos | **Supabase Storage** | Free |
| API (Node + Socket.IO) | **Render** | Free |
| App (versão web) | **Netlify** | Free |

Siga nesta ordem: a API precisa existir antes do app, e o app antes de fechar o CORS.

> Os limites dos planos grátis mudam de tempos em tempos. Confira no site de cada serviço.

---

## 1. Supabase: onde as fotos ficam

1. Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (qualquer nome, ex.: `stans`).
2. Menu **Storage** > **New bucket**:
   - Nome: `stans`
   - Marque **Public bucket**
3. Menu **Project Settings** > **API Keys**: copie a **secret key** (ou a `service_role`, se só aparecer essa).
4. Em **Project Settings** > **Data API** (ou na página inicial do projeto): copie a **Project URL** (`https://xxxx.supabase.co`).

⚠️ A secret key dá acesso total ao projeto. Ela só vai no Render, **nunca** no app nem no GitHub.

## 2. Render: a API

1. Crie uma conta em [render.com](https://render.com) entrando com o GitHub.
2. **New** > **Blueprint** > escolha o repositório `stans`. O Render lê o arquivo `render.yaml`.
3. Ele pede alguns valores:

   | Variável | O que colocar |
   |---|---|
   | `DATABASE_URL` | Connection string do Neon (no painel do Neon: **Connect**) |
   | `SUPABASE_URL` | Project URL do passo 1 |
   | `SUPABASE_SERVICE_KEY` | Secret key do passo 1 |
   | `CORS_ORIGIN` e `APP_URL` | Deixe em branco por enquanto (passo 4) |

   O `JWT_SECRET` é gerado sozinho.
4. Clique em **Apply**. O build instala, compila e **aplica as migrações no banco**.
5. Quando terminar, abra `https://stans-api.onrender.com/health` (o endereço exato aparece no topo da página do serviço). Tem que mostrar `{"ok":true}`.

💡 Quer que o app no ar use um banco separado do seu computador? No Neon, crie um **branch** (ex.: `producao`) e use a connection string dele.

## 3. Netlify: o app

1. No [Netlify](https://app.netlify.com) (a mesma conta do portfólio): **Add new site** > **Import an existing project** > **GitHub** > `stans`.
2. As configurações já vêm do `netlify.toml`. Não mude nada.
3. Antes de publicar, em **Environment variables**, crie:
   - `EXPO_PUBLIC_API_URL` = endereço do Render, sem barra no final (ex.: `https://stans-api.onrender.com`)
4. **Deploy**. Depois, em **Site configuration** > **Change site name**, escolha um nome (ex.: `stans-app` → `https://stans-app.netlify.app`).

Se mudar o `EXPO_PUBLIC_API_URL` depois, rode **Deploys** > **Trigger deploy**: o endereço entra no app na hora do build.

## 4. Fechar o CORS

No Render, em **Environment**, preencha com o endereço do Netlify (sem barra no final):
- `CORS_ORIGIN` = `https://stans-app.netlify.app`
- `APP_URL` = `https://stans-app.netlify.app`

Salve. O Render publica de novo sozinho.

Pronto: o Stans está no ar. 🎉 Coloque o link do Netlify no portfólio e no README.

---

## Bom saber

- **A API dorme** depois de uns 15 minutos sem uso no plano grátis do Render. O primeiro acesso depois disso demora perto de 1 minuto; os seguintes são normais.
- **Fotos antigas**: fotos enviadas no seu computador ficaram em `server/uploads` e não vão para a nuvem. Se o banco for o mesmo, envie de novo a foto de perfil e a capa pelo app no ar.
- **Trocar senha**: ainda não manda e-mail. O link aparece nos **Logs** do serviço no Render.
- **Atualizações**: cada `git push` na `main` publica de novo a API (Render) e o app (Netlify) sozinhos.

## Android (opcional)

Para gerar um APK e instalar no celular sem a Play Store, use o EAS Build da Expo (tem plano grátis):

```bash
cd mobile-app
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build -p android --profile preview
```

No `eas.json` criado, coloque `"android": { "buildType": "apk" }` no perfil `preview` e `"env": { "EXPO_PUBLIC_API_URL": "https://stans-api.onrender.com" }`. Publicar na Play Store custa uma taxa única de US$ 25.
