// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const js = require("@eslint/js");
const globals = require("globals");
const importPlugin = require("eslint-plugin-import");

console.log('Loading ESLint configuration...');

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    plugins: { js, import: importPlugin },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],

      // Reactive pattern rules
      "no-restricted-syntax": [
        "error",
        {
          "selector": "CallExpression[callee.name='computed'] CallExpression[callee.property.name=/^(subscribe|observe|then)$/]",
          "message": "Avoid using non-reactive patterns inside computed signals."
        },
        {
          "selector": "TSTypeReference[typeName.name='Observable']",
          "message": "Use Signal<T> instead of Observable<T> in this signal-first codebase"
        },
        {
          "selector": "Identifier[name=/.*\\$$/]",
          "message": "Property names ending with $ (indicating Observables) should be replaced with signal-based patterns"
        }
      ],
      
      "no-restricted-imports": ["error", {
        "paths": [
          {
            "name": "@angular/core",
            "importNames": ["effect"],
            "message": "Use computed signals instead of effects for reactivity"
          }
        ]
      }],


      "@typescript-eslint/no-explicit-any": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],

      "@typescript-eslint/no-empty-function": [
        "error",
        {
          "allow": ["arrowFunctions", "functions", "methods"]
        }
      ],

      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          "allowShortCircuit": true,
          "allowTernary": true,
          "allowTaggedTemplates": true
        }
      ],

      "@typescript-eslint/no-unsafe-argument": "error",

      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": ["function", "method"],
          "format": ["camelCase"],
          "failureMessage": "Avoid non-reactive pattern names in signal-based code",
          "filter": {
            "regex": "^(effect|subscribe|observe|Promise|async|Observable|setTimeout|runInInjectionContext|queueMicrotask|ChangeDetectorRef)",
            "match": false
          }
        },
        {
          "selector": ["property", "classProperty", "typeProperty", "parameter", "interface"],
          "format": null,
          "failureMessage": "Types containing Observable or Subject should use Signal<T> instead",
          "filter": {
            "regex": ".*(Observable|Subject).*",
            "match": true
          }
        },
        {
          "selector": ["property", "classProperty", "typeProperty"],
          "format": null,
          "failureMessage": "Properties ending with $ should be converted to use signals",
          "filter": {
            "regex": ".*\\$$",
            "match": true
          }
        }
      ],
      "semi": ["error", "always"],
      
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // Global rule: All src files can only import from the 6 defined layers
            {
              target: "./src/**/*",
              from: [
                "./src/!(common|domain|enactment|infrastructure|integration|presentation)/**",
                "./src/!(common|domain|enactment|infrastructure|integration|presentation)/*"
              ],
              message: "Files in src/ can only import from the 6 defined architectural layers: common, domain, enactment, infrastructure, integration, presentation.",
            },
            {
              target: "./src/common",
              from: [ // Common can import nothing
                "./src/domain",
                "./src/enactment",
                "./src/infrastructure",
                "./src/integration",
                "./src/presentation",
              ],
              message: "Common layer must not import from any other layer.",
            },
            {
              target: "./src/domain",
              from: [  // Domain can only import from Common
                "./src/enactment", 
                "./src/infrastructure", 
                "./src/integration", 
                "./src/presentation"
              ],
              message: "Domain layer must only import from Common.",
            },
            {
              target: "./src/enactment",
              from: [ // Enactment can import from Domain and Common
                "./src/infrastructure",
                "./src/integration",
                "./src/presentation",
              ],
              message: "Enactment layer must only import from Domain and Common.",
            },
            {
              target: "./src/infrastructure",
              from: [ // Infrastructure can import from Enactment, Domain, and Common
                "./src/integration",
                "./src/presentation",
              ],
              message: "Infrastructure layer must only import from Enactment, Domain, and Common.",
            },
            {
              target: "./src/integration",
              from: [ // Integration can import from anywhere
              ],
              message: "Integration layer must only import from Infrastructure, Enactment, Domain, and Common.",
            },
            {
              target: "./src/presentation",
              from: [  
                "./src/domain",
                "./src/enactment",
                "./src/infrastructure"], // Presentation can only import from common and integration
              message: "Presentation layer can only import from Common and Integration layers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {},
  }
);
