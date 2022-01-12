export type ParsedArgs = [Map<string, string[]>, string | undefined];
const KEY_REGEXP = /^--?(.+)$/;

export const colors = new Map(
  [
    ["name", "\x1b[32m"],
    ["version", "\x1b[33m"],
    ["description", "\x1b[36m"],
    ["category", "\x1b[35m"],
    ["option", "\x1b[32m"],
    ["optionDescription", "\x1b[36m"],
    ["argument", "\x1b[31m"],
    ["argumentName", "\x1b[35m"],
    ["argumentType", "\x1b[32m" as string],
  ] as const,
);

if (Deno.noColor) {
  for (const [color] of colors.entries()) {
    colors.set(color, "");
  }
}

let error = (error: Error): void => {
  throw error;
};

/**
 * Parse Deno.args to ParsedArgs
 * @param args
 */
export function parseArgs(args = Deno.args): ParsedArgs {
  const parsed = new Map<string, string[]>();
  const subcommand = !KEY_REGEXP.test(args[0]) ? args[0] : undefined;
  let key;
  for (const arg of args) {
    if (arg === subcommand) continue;

    if (KEY_REGEXP.test(arg)) {
      key = arg.replace(KEY_REGEXP, "$1");
      parsed.set(key, []);
      continue;
    }

    if (!key) {
      error(
        new Error(
          "Failed parsing arguments, missing key for given option",
        ),
      );
      break;
    }

    parsed.set(key, parsed.get(key)!.concat(arg));
  }

  return [parsed, subcommand];
}

type ArgumentType = "string" | "number" | "boolean" | "any";
interface SubCommandOption {
  /** Name of the option */
  name: string;
  /** Longer aliases, prefixed with two dashes */
  aliases?: string[];
  /** Shorter aliases, prefixed with single dash, typically one char long */
  shortAliases?: string[];
  /** Description of option */
  description?: string;
  /** Whether option is required in subcommand */
  required: boolean;
  /** Arguments for options */
  arguments?: {
    /** Name of the argument */
    name: string;
    /** Type of the option (it'll be checked in runtime) */
    type?: ArgumentType;
    /** Whether argument is required in option */
    required?: boolean;
  }[];
  /** Function that's ran when option is present */
  func?: (...args: string[]) => void;
  /** Priority of option */
  priority?: number;
}

interface CreateSubCommandOptions {
  /** Name of the subcommand */
  name: string;
  /** Description of the SubCommand */
  description?: string;
  /** Subcommand Options */
  options?: SubCommandOption[];
  /** Function that's ran when subcommand is used */
  func?: () => void;
}

interface SubCommand {
  /** Name of the subcommand1 */
  name: string;
  /** Description of the SubCommand */
  description?: string;
  /** Subcommand Options */
  options?: SubCommandOption[];
  /** Function that's ran when subcommand is used */
  func?: () => void;
}

/**
 * Parse given value to type supported by Colepio
 * @param value
 */
export function parseType(value: string): ArgumentType | undefined {
  if (typeof value !== "string") return undefined;
  if (!Number.isNaN(Number(value))) return "number";
  if (value === "true" || value === "false") return "boolean";
  return "string";
}

/**
 * Create subcomamnd
 * @param options
 */
export function createSubCommand(
  { name, description, options, func }: CreateSubCommandOptions,
): SubCommand {
  return {
    name,
    description,
    options,
    func,
  };
}

/**
 * Function used to run subcommands with given parsed arguments
 * @param subCmd
 * @param argsObj
 */
export function runSubCommand(
  subCmd: SubCommand,
  argsObj: Map<string, string[]>,
): void {
  if (subCmd.options) {
    let options: [SubCommandOption, string[]][] = [];

    for (
      const { aliases, shortAliases, required } of subCmd.options
    ) {
      if (
        required &&
        aliases?.every((alias) => argsObj.get(alias) === undefined) &&
        shortAliases?.every((alias) => argsObj.get(alias) === undefined)
      ) {
        error(
          new Error(
            // deno-fmt-ignore
            `Option missing: Option ${shortAliases?.length ? `-${shortAliases[0]}` : ""}, --${aliases[0]} is required in ${subCmd.name} subcommand`,
          ),
        );
        break;
      }
    }

    for (const [name, args] of argsObj.entries()) {
      const option = subCmd.options.find(({ aliases, shortAliases }) =>
        aliases?.includes(name) || shortAliases?.includes(name)
      );

      if (!option) {
        error(
          new Error(
            `Option not found: Option ${name} has not been found in ${subCmd.name} subcommand`,
          ),
        );
        break;
      }

      if (
        !option?.aliases?.includes(name) &&
        !option?.shortAliases?.includes(name)
      ) {
        continue;
      }

      const optionArgs: string[] = [];

      if (option.arguments?.length) {
        for (
          let [i, { name, type, required }] of option.arguments.entries()
        ) {
          type ??= "any";

          const value = args[i];
          const actualType = parseType(value);

          if (value === "-" && !required) {
            ++optionArgs.length;
            continue;
          } else if (actualType === undefined && required) {
            console.log("errored");
            error(
              new Error(
                `Missing option argument: ${name} is missing in ${subCmd.name}`,
              ),
            );
            continue;
          } else if (type !== "any" && actualType !== type) {
            console.log("errored");
            error(
              new Error(
                `Invalid option arguments: ${name} – got ${actualType}, expected ${type}`,
              ),
            );
            continue;
          }
          optionArgs.push(value);
        }
      } else if (args.length) {
        error(
          new Error(
            `Invalid arguments length: Option ${name} doesn't take any arguments (got ${args.length})`,
          ),
        );
      }

      options.push([option, optionArgs]);
    }

    options = options.sort(([a], [b]) => (a.priority || 0) - (b.priority || 0));

    for (const [option, args] of options) {
      option.func?.(...args);
    }
  }

  subCmd.func?.();
}

interface CreateCliOptions {
  /** Name of the CLI */
  name: string;
  /** Description of the CLI */
  description?: string;
  /** Version of the CLI */
  version?: string | number;
  /** Command that's ran when no arguments are given */
  mainSubCmd: SubCommand;
  /** Subcommands that can be fired */
  subCmds?: SubCommand[];
  /** Whether it should generate help message */
  generateHelp?: boolean;
  /** Whether to display argument types in help message */
  displayHelpTypes?: boolean;
  /** When present functions instead of throwing will call to this function */
  catchErrors?: (error: Error) => void;
}

interface Cli {
  /** Name of the CLI */
  name: string;
  /** Description of the CLI */
  description?: string;
  /** Version of the CLI */
  version?: string | number;
  /** Command that's ran when no arguments are given */
  mainSubCmd: SubCommand;
  /** Subcommands that can be fired */
  subCmds?: SubCommand[];
  /** Whether to display argument types in help message */
  displayHelpTypes?: boolean;
  /** Starts CLI */
  run: () => void;
}
/**
 * Create CLI instance
 * @param options
 */
export function createCli(
  {
    name,
    description,
    version,
    mainSubCmd,
    subCmds,
    generateHelp,
    displayHelpTypes,
    catchErrors,
  }: CreateCliOptions,
): Cli {
  if (catchErrors) error = catchErrors;

  return {
    name,
    description,
    version,
    mainSubCmd,
    subCmds,
    displayHelpTypes,
    run([parsedArgs, parsedSubCmd]: ParsedArgs = parseArgs(Deno.args)) {
      const subCmd = parsedSubCmd
        ? subCmds?.find(({ name }) => name === parsedSubCmd)
        : mainSubCmd;

      if (!subCmd) {
        return error(
          new Error(
            `Subcommand missing: Subcommand ${parsedSubCmd} has not been found in ${name} CLI.`,
          ),
        );
      }

      if (generateHelp && (parsedArgs.get("h") || parsedArgs.get("help"))) {
        // deno-fmt-ignore
        let helpMessage = `${colors.get("name")}${name}\x1b[0m`;

        helpMessage += version
          ? ` (${colors.get("version")}${version}\x1b[0m)\n`
          : "\n";

        if (description) {
          helpMessage += ` » ${
            colors.get("description")
          }${description}\x1b[0m\n`;
        }

        if (subCmd.options) {
          helpMessage += `\n${colors.get("category")}Options:\x1b[0m\n`;
          for (const option of subCmd.options) {
            const aliases = (option?.shortAliases?.map((x) => `-${x}`) || [])
              .concat(
                option?.aliases?.map((x) => `--${x}`) || [],
              );

            const args = option.arguments?.map((arg) =>
              `${colors.get("argument")}[${
                colors.get("argumentName")
              }${arg.name}${
                displayHelpTypes
                  ? ` ${colors.get("argumentType")}{${arg.type ?? "any"}}`
                  : ""
              }\x1b[0m${colors.get("argument")}]\x1b[0m`
            ) ?? [];

            // deno-fmt-ignore
            helpMessage += ` » ${colors.get("option")}${aliases.join(`\x1b[0m, ${colors.get("option")}`)}\x1b[0m ${option.description ? `– ${colors.get("optionDescription")}${option.description}\x1b[0m` : ""} ${args.length ? "»" : ""} ${args.join(" ")}\n`;
          }
        }

        if (subCmd === mainSubCmd && subCmds?.length) {
          helpMessage += `\n${colors.get("category")}Subcommands:\x1b[0m\n`;
          for (const subCmd of subCmds) {
            // deno-fmt-ignore
            helpMessage += ` » ${subCmd.name} ${subCmd.description ? `– ${subCmd.description}` : ""}\n`;
          }
        }

        console.log(helpMessage);
        Deno.exit(0);
      }

      if (parsedSubCmd) {
        if (!subCmds) {
          return error(new Error("This command doesn't accept subcommands"));
        }
        const subCmd = subCmds.find(({ name }) => name === parsedSubCmd)!;
        runSubCommand(subCmd, parsedArgs);
      } else {
        runSubCommand(mainSubCmd, parsedArgs);
      }
    },
  };
}
