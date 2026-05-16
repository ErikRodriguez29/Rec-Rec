import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter } from "react-router";
import App from "./App";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

const googleClientId =
  import.meta.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const appTree = (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{appTree}</GoogleOAuthProvider>
  ) : (
    appTree
  ),
);
