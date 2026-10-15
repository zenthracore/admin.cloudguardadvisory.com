# Stage 1: Build Admin frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY admin/package.json ./
RUN npm install

COPY admin/ ./
RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
