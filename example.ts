import { createCli, createSubCommand } from "./mod.ts";

const cli = createCli({
  name: "Test",
  version: "0.1.0",
  description: "Hello world",
  mainSubCmd: createSubCommand({
    name: "main",
    description: "Main command",
    options: [
      {
        name: "test",
        aliases: ["test"],
        shortAliases: ["t"],
        description: "Test option",
        arguments: [
          {
            name: "uno",
          },
        ],
        required: true,
        func(value) {
          console.log("hi", value);
        },
      },
    ],
  }),
  subCmds: [
    createSubCommand({
      name: "test",
      description: "Test subcommand",
      func() {
        console.log("HI!");
      },
      options: [
        {
          name: "hello",
          aliases: ["hello"],
          description: "Hello option",
          required: false,
          arguments: [
            {
              name: "uno",
              required: true,
            },
            {
              name: "dos",
              required: false,
            },
            {
              name: "tres",
              required: true,
              type: "string",
            },
          ],
          func(a, b, c) {
            console.log(a, b, c);
          },
        },
      ],
    }),
  ],
  generateHelp: true,
  displayHelpTypes: true,
  catchErrors(error) {
    console.log(error.message);
  },
});

cli.run();
