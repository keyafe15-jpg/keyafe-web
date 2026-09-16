/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
  // Sorts the class strings passed through each app's cn() helper, not just className.
  tailwindFunctions: ["cn"],
  // Tailwind v4 reads config from CSS, and each app has its own entrypoint, so the
  // class sorter needs to be pointed at them per workspace.
  overrides: [
    {
      files: "admin/**",
      options: { tailwindStylesheet: "./admin/src/index.css" },
    },
    {
      files: "client/**",
      options: { tailwindStylesheet: "./client/src/index.css" },
    },
  ],
};
