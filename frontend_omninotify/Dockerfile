# ---------- BUILD STAGE ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar dependencias primero (mejora cache)
COPY package*.json ./
RUN npm install

# Copiar código
COPY . .

# Build producción
RUN npm run build


# ---------- PRODUCTION STAGE ----------
FROM nginx:alpine

# Eliminar configuración default
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copiar build generado
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
