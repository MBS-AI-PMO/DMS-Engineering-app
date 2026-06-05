FROM node:22.12.0-bookworm

WORKDIR /app

ARG VITE_API_URL
ARG VITE_API_BASE_URL
ARG VITE_PYTHON_API_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_PYTHON_API_URL=$VITE_PYTHON_API_URL

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]