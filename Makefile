COMPOSE ?= docker compose

.PHONY: regen mock docs dev

regen:
	pnpm gen:all

mock:
	$(COMPOSE) up prism sms-sim

docs:
	$(COMPOSE) up docs

dev:
	$(COMPOSE) up

