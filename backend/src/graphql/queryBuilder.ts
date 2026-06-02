export type GraphQLArgValue = string | number | boolean | null;

export type ChartConfig = {
  rootField: string;
  fields: string[];
  args?: Record<string, GraphQLArgValue>;
  operationName?: string;
};

const GRAPHQL_NAME_REGEX = /^[_A-Za-z][_0-9A-Za-z]*$/;

function validateGraphQLName(name: string, label: string): void {
  if (!GRAPHQL_NAME_REGEX.test(name)) {
    throw new Error(`${label} must be a valid GraphQL name.`);
  }
}

function serializeArgValue(value: GraphQLArgValue): string {
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Number arguments must be finite.");
    }

    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  return "null";
}

function buildArgs(args?: Record<string, GraphQLArgValue>): string {
  if (!args || Object.keys(args).length === 0) {
    return "";
  }

  const serializedArgs = Object.entries(args).map(([key, value]) => {
    validateGraphQLName(key, "Argument name");
    return `${key}: ${serializeArgValue(value)}`;
  });

  return `(${serializedArgs.join(", ")})`;
}

export function buildGraphQLQuery(config: ChartConfig): string {
  validateGraphQLName(config.rootField, "Root field");

  if (config.operationName) {
    validateGraphQLName(config.operationName, "Operation name");
  }

  if (config.fields.length === 0) {
    throw new Error("At least one field is required.");
  }

  config.fields.forEach((field) => {
    validateGraphQLName(field, "Field name");
  });

  const operationName = config.operationName ? ` ${config.operationName}` : "";
  const args = buildArgs(config.args);
  const fields = config.fields.map((field) => `    ${field}`).join("\n");

  return `query${operationName} {
  ${config.rootField}${args} {
${fields}
  }
}`;
}