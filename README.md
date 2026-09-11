# AiProductsSelectionFrontend

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.21.

## Local frontend/backend development

The backend uses a fixed HTTP Basic account in the `dev` profile. Add both
`DEV_BASIC_AUTH_USERNAME` and `DEV_BASIC_AUTH_PASSWORD` to
`../ai-products-selection-backend/chen-weishan/.env` (see its `.env.example`).
From the workspace root, start the backend from the actual Gradle project root:

```powershell
cd ai-products-selection-backend\chen-weishan
.\gradlew.bat :ssds-api:bootRun
```

The OpenAPI document is public in the dev security configuration. In a second
terminal at the workspace root, install dependencies, regenerate the Angular
client, and start the UI:

```powershell
cd ai-products-selection-frontend
npm install
npm run generate:api
npm start
```

Open `http://localhost:4200/`. The Angular development proxy reads the same
backend `.env` and adds Basic Auth server-side, so credentials are neither
committed nor bundled into browser JavaScript. API calls continue to use the
relative `/api/v1` base path configured in `src/app/app.config.ts`.

If the repositories are not siblings in this workspace, set `SSDS_BACKEND_DIR`
to the backend Gradle project directory before running `npm start`.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
