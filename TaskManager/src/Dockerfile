FROM node:latest AS application

WORKDIR /app

COPY package.json ./

RUN npm install 

COPY . .

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD [ "executable" ] curl --fail https://localhost:8000 || exit 1



CMD ["npm", "run", "dev"]


