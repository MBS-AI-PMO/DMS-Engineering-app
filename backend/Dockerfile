FROM node:20-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    freecad \
    python3 \
    python3-networkx \
    python3-numpy \
    python3-pip \
    python3-venv \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

RUN python3 -m venv /opt/cadquery-env \
    && /opt/cadquery-env/bin/pip install --upgrade pip \
    && /opt/cadquery-env/bin/pip install -r requirements.txt

ENV FREECAD_PATH=/usr/bin/freecadcmd
ENV PYTHON_PATH=/opt/cadquery-env/bin/python
ENV UNFOLD_LIB_PATH=/app/unfold_lib.py  

RUN mkdir -p /app/uploads /app/temp_uploads
VOLUME ["/app/uploads", "/app/temp_uploads"]

EXPOSE 5000
EXPOSE 8000

CMD ["npm", "run", "start:prod"]
