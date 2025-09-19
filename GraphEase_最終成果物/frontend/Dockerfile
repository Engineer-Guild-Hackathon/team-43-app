# 日本語：Node 20 の軽量イメージを使う
FROM node:20-slim

WORKDIR /app

# 日本語：ロックファイルを使って再現性インストール
COPY package*.json ./
RUN npm ci --omit=dev

# 日本語：アプリ本体をコピーして本番ビルド
COPY . .
RUN npm run build

# 日本語：Hugging Face が割り当てる PORT を使う
ENV PORT=7860
EXPOSE 7860

# 日本語：Next を本番起動（package.json の start が -p に対応済み）
CMD ["npm","run","start"]
