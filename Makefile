.PHONY: migrate seed dev build deploy logs restart rebuild up down studio

migrate:
	docker compose exec cashmind_api npx prisma migrate dev

seed:
	docker compose exec cashmind_api npx prisma db seed

dev:
	docker compose up -d

build:
	docker compose build

deploy:
	git pull origin claude/cashmachine-b2b-platform-pL5Y2 && docker compose up -d --build

logs:
	docker compose logs -f

restart:
	docker compose restart

rebuild:
	docker compose down && docker compose up -d --build

up:
	docker compose up -d --build

down:
	docker compose down

studio:
	docker compose exec cashmind_api npx prisma studio
