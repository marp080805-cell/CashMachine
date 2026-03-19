up:
	docker-compose up -d --build

down:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	docker-compose exec cashmachine_api npx prisma migrate deploy

studio:
	docker-compose exec cashmachine_api npx prisma studio

seed:
	docker-compose exec cashmachine_api npx ts-node prisma/seed.ts

restart:
	docker-compose restart cashmachine_api cashmachine_frontend
