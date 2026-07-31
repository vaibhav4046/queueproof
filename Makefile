.PHONY: setup dev test doctor eval security build
setup:
	pnpm install
dev:
	pnpm dev
test:
	pnpm test
doctor:
	pnpm doctor
eval:
	QUEUEPROOF_TEST_MODE=true pnpm eval
security:
	pnpm test:security
build:
	pnpm build
