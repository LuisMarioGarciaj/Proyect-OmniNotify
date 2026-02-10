# Imagen base (Vite 5+ requiere Node 20+)
FROM node:20-bullseye

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero los package para aprovechar cache
COPY package.json package-lock.json ./

# Instalamos dependencias (linux)
RUN npm install

# Copiamos todo el proyecto
COPY . .

# Puerto que usa Vite
EXPOSE 5173

# Comando DEV (IMPORTANTE --host para Docker)
CMD ["npm", "run", "dev", "--", "--host"]
