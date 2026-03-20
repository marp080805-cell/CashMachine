up:
	docker-compose up -d --build

down:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	docker-compose exec cashmind_api npx prisma migrate deploy

studio:
	docker-compose exec cashmind_api npx prisma studio

seed:
	docker-compose exec cashmind_api npx ts-node prisma/seed.ts

restart:
	docker-compose restart cashmind_api cashmind_frontend
