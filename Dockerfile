# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

# Instalar dependências
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --upgrade pip

COPY . .

# Definir variáveis de ambiente
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5000
ENV FLASK_ENV=production  

EXPOSE 5000

# Comando para iniciar o Flask
CMD ["flask", "run"]