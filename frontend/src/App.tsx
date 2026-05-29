import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { Routes, Route } from "react-router";
import TwoPanelLayout from "./mainPage/TwoPanelLayout";

const theme = createTheme({
  palette: {
    primary: { main: "#aa3bff" },
    background: { default: "#f6f7fb", paper: "#ffffff" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: `system-ui, "Segoe UI", Roboto, sans-serif`,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 10 },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          "&:before": { display: "none" },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<TwoPanelLayout />} />
      </Routes>
    </ThemeProvider>
  );
}
