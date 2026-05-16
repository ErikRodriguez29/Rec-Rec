import { Routes, Route, Link as RouterLink } from "react-router";
import { Link, Stack, Typography } from "@mui/material";
import RecreationSurvey from "./RecreationSurvey";

const Home = () => (
  <Stack sx={{ p: 3 }} spacing={2}>
    <Typography variant="h4" component="h1">
      Rec Rec
    </Typography>
    <Typography variant="body1" color="text.secondary">
      UCSB Recreation Center recommender — set preferences on the survey, then use Run recommender{" "}
      while developing (<code>pnpm dev</code> in <code>frontend/</code>). That runs{" "}
      <code>scripts/recommender/recommend-times.py</code> locally and prints the forecast-based
      times on the page.
    </Typography>
    <Link component={RouterLink} to="/survey" underline="hover">
      Open recreation preferences survey
    </Link>
  </Stack>
);

const About = () => (
  <Typography sx={{ p: 3 }} variant="h4" component="h1">
    About
  </Typography>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/survey" element={<RecreationSurvey />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
