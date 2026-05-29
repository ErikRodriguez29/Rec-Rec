import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  eventsToSlots,
  filterEventsForWeek,
  formatEventTime,
  formatWeekRange,
  getWeekMonday,
  parseICS,
} from "../../utils/icsParser";
import type { CalEvent } from "../../utils/icsParser";

const CALENDAR_INSTRUCTIONS: { label: string; emoji: string; steps: string[] }[] = [
  {
    label: "Google Calendar",
    emoji: "🗓️",
    steps: [
      "Open Google Calendar and click the gear icon → Settings",
      "In the left sidebar, click the calendar you want to export",
      'Scroll down to "Export calendar" and click Export',
      "Unzip the downloaded file to get the .ics file",
      "Upload it below",
    ],
  },
  {
    label: "Apple Calendar",
    emoji: "🍎",
    steps: [
      "Open Calendar on your Mac",
      "Click File → Export → Export…",
      "Save the .ics file, then upload it below",
    ],
  },
  {
    label: "Outlook",
    emoji: "📧",
    steps: [
      "Open Outlook and go to your Calendar",
      "Click File → Save Calendar",
      "Choose a date range, save as .ics, then upload it below",
    ],
  },
];

interface CalendarImportProps {
  onImport: (slots: string[]) => void;
}

const CalendarImport = ({ onImport }: CalendarImportProps) => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const weekMonday = getWeekMonday(0);
  const weekEvents = filterEventsForWeek(events, weekMonday);
  const slots = eventsToSlots(events, weekMonday);

  const processFile = (file: File) => {
    setError(null);
    if (!file.name.endsWith(".ics") && file.type !== "text/calendar") {
      setError("Please upload a .ics calendar file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") setEvents(parseICS(result));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleClose = () => {
    setOpen(false);
    setEvents([]);
    setError(null);
  };

  const handleApply = () => {
    onImport(slots);
    handleClose();
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<CalendarMonthIcon />}
        onClick={() => setOpen(true)}
        sx={{ textTransform: "none", borderRadius: 2, whiteSpace: "nowrap" }}
      >
        Import Calendar
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CalendarMonthIcon color="primary" />
            Import Busy Times from Calendar
          </Box>
        </DialogTitle>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          {/* Instructions */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Export your calendar as a <strong>.ics file</strong> and upload it below. Your
              existing events will be marked as unavailable on the schedule grid.
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {CALENDAR_INSTRUCTIONS.map(({ label, emoji, steps }) => (
                <Box
                  key={label}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 1.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, display: "block", mb: 0.75 }}
                  >
                    {emoji} {label}
                  </Typography>
                  <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
                    {steps.map((step, i) => (
                      <Typography
                        key={i}
                        component="li"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.25 }}
                      >
                        {step}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Upload zone */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                display: "block",
                mb: 1,
              }}
            >
              Upload .ics file
            </Typography>
            <Box
              sx={{
                border: "2px dashed",
                borderColor: isDragOver ? "primary.main" : "grey.300",
                borderRadius: 2,
                p: 3,
                textAlign: "center",
                cursor: "pointer",
                bgcolor: isDragOver ? "action.hover" : "grey.50",
                transition: "all 200ms",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics,text/calendar"
                hidden
                onChange={handleFileChange}
              />
              <CloudUploadIcon sx={{ fontSize: 36, color: "grey.400", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Drop <strong>.ics</strong> file here or click to browse
              </Typography>
            </Box>
          </Box>

          {/* Event preview */}
          {events.length > 0 && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {weekEvents.length} event{weekEvents.length !== 1 ? "s" : ""} in{" "}
                  {formatWeekRange(weekMonday)}
                </Typography>
                <Chip
                  label={`${events.length} total`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 11, height: 20, "& .MuiChip-label": { px: 0.75 } }}
                />
              </Box>
              {weekEvents.length > 0 ? (
                <List
                  dense
                  disablePadding
                  sx={{
                    maxHeight: 160,
                    overflowY: "auto",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1.5,
                  }}
                >
                  {weekEvents.map((ev, i) => (
                    <ListItem key={i} divider={i < weekEvents.length - 1} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {ev.summary}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatEventTime(ev)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No events found for this week in your calendar.
                </Typography>
              )}
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ fontSize: 12 }}>
              {error}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={weekEvents.length === 0}
            sx={{ textTransform: "none" }}
          >
            {weekEvents.length > 0
              ? `Block ${slots.length} slot${slots.length !== 1 ? "s" : ""}`
              : "No events to import"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CalendarImport;
