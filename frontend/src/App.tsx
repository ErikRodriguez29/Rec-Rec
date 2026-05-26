import { Navigate, Route, Routes } from "react-router";
import { Typography } from "@mui/material";
import RecreationSurvey from "./RecreationSurvey";

const About = () => (
  <Typography sx={{ p: 3 }} variant="h4" component="h1">
    About
  </Typography>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RecreationSurvey />} />
      <Route path="/survey" element={<Navigate to="/" replace />} />
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
