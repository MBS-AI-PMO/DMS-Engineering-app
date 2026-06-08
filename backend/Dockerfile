FROM node:20-bookworm-slim

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    freecad \
    python3 \
    python3-networkx \
    python3-numpy \
    python3-pip \
    python3-venv \
    build-essential \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY package*.json ./
RUN npm install \
    && npm cache clean --force

COPY requirements.txt ./

RUN python3 -m venv /opt/cadquery-env \
    && /opt/cadquery-env/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/cadquery-env/bin/pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip /tmp/* /var/tmp/*

COPY . .

ENV FREECAD_PATH=/usr/bin/freecadcmd
ENV PYTHON_PATH=/opt/cadquery-env/bin/python
ENV UNFOLD_LIB_PATH=/app/unfold_lib.py  

RUN mkdir -p /app/uploads /app/temp_uploads
VOLUME ["/app/uploads", "/app/temp_uploads"]

EXPOSE 5000
EXPOSE 8000

CMD ["npm", "run", "start:prod"]
