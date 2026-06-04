import "./FacilityForecastCards.css";

const FORECAST_IMAGES = [
  {
    title: "All Facilities",
    subtitle: "Overall facility demand forecast",
    src: "/forecasts/1All Facilities Forecast.png",
  },
  {
    title: "Frequented Facilities",
    subtitle: "Most-used facilities forecast",
    src: "/forecasts/2Frequented Facilities Forecast.png",
  },
  {
    title: "Pool Facilities",
    subtitle: "Pool usage forecast",
    src: "/forecasts/3Pool Facilities Forecast.png",
  },
  {
    title: "Climbing Center",
    subtitle: "Climbing center forecast",
    src: "/forecasts/4Climbing Center Forecast.png",
  },
  {
    title: "Racquetball",
    subtitle: "Racquetball facility forecast",
    src: "/forecasts/5Racquetball Forecast.png",
  },
  {
    title: "Remaining Facilities",
    subtitle: "Other facility forecasts",
    src: "/forecasts/6Remaining Facilities Forecast.png",
  },
];

const FacilityForecastCards = () => {
  return (
    <div className="facility-forecast-panel">
      <div className="section-title">
        <h2>Facility Forecasts</h2>
      </div>

      <div className="forecast-card-grid">
        {FORECAST_IMAGES.map((image) => (
          <article className="forecast-card" key={image.src}>
            <div className="forecast-card-copy">
              <h3>{image.title}</h3>
              <p>{image.subtitle}</p>
            </div>

            <div className="forecast-image-wrap">
              <img src={image.src} alt={`${image.title} forecast`} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default FacilityForecastCards;
