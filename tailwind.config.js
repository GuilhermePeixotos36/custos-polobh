/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#15161A", 2: "#585C66", 3: "#7E838D" },
        black: "#0B0B0D",
        primary: {
          DEFAULT: "#F2820D",
          dark: "#E36F0A",
          soft: "#FDF1E3",
        },
        amber: "#FBB040",
        "active-border": "#F6DEC0",
        graphite: "#3A3C44",
        bg: "#E8EAEE",
        surface: "#FFFFFF",
        border: { DEFAULT: "#D6D9E0", soft: "#E4E6EC" },
        success: { DEFAULT: "#0E7C50", soft: "#E4F6EE" },
        warning: { DEFAULT: "#9A6B0E", soft: "#FBF1DA" },
        danger: { DEFAULT: "#C13438", soft: "#FBE7E7" },
        info: { DEFAULT: "#1B4FD1", soft: "#EAF1FE" },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        display: ["Sora", "system-ui", "sans-serif"],
      },
      borderRadius: {
        btn: "11px",
        card: "16px",
        "card-lg": "18px",
        pill: "99px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,30,66,.04)",
        btn: "0 10px 20px -10px rgba(242,130,13,.55)",
        modal: "0 40px 90px -30px rgba(16,30,66,.28)",
      },
      backgroundImage: {
        "brand-mesh":
          "linear-gradient(120deg, #FBB040 0%, #F2820D 45%, #8C8E96 100%)",
        "primary-grad": "linear-gradient(135deg, #FBB040, #F2820D)",
        "avatar-grad": "linear-gradient(135deg, #3A3C44, #0B0B0D)",
        "progress-grad": "linear-gradient(90deg, #FBB040, #F2820D)",
      },
    },
  },
  plugins: [],
};
