import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "captured-site/**",
      "Mockup 3D/**",
      "Iconos Logo Bancos/**",
      "Videos/**",
      "node_modules/**"
    ]
  },
  ...nextVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "import/no-anonymous-default-export": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off"
    }
  }
];
