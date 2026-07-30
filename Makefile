test:
	npm run test

test/contracts:
	npm run test:contracts

lint:
	npm run lint && npm run format:check

lint-fix:
	npm run lint:fix
	npm run format

run:
	npm run dev

update:
	npm install
