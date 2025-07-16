# Makefile
.PHONY: help build up down restart logs shell test

# Nome do serviço definido no docker-compose
SERVICE=flask-stripe-checkout_web_1

# Mostra os comandos disponíveis
help:
	@echo "Comandos disponíveis:"
	@echo "  make build     - Constrói a imagem Docker"
	@echo "  make up        - Sobe os containers"
	@echo "  make down      - Derruba os containers"
	@echo "  make restart   - Reinicia os containers"
	@echo "  make logs      - Mostra os logs"
	@echo "  make shell     - Abre um shell dentro do container"
	@echo "  make test      - Roda os testes (se houver)"

# Constrói a imagem Docker
build:
	docker-compose build

# Sobe os containers
up:
	docker-compose up

# Derruba os containers
down:
	docker-compose down

# Reinicia os containers
restart:
	docker-compose down && docker-compose up --build

# Logs com tail -f
logs:
	docker-compose logs -f

# Entra no shell do container
shell:
	docker exec -it $(SERVICE) sh

# Exemplo de execução de testes (adapte conforme estrutura)
test:
	docker exec -it $(SERVICE) pytest
