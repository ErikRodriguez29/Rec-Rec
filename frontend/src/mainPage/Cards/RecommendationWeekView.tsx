import { DAY_ORDER } from "../../constants";
import type { CategoryRec, WeekRecs } from "../../types";
import { getAlternateTime } from "./recommendationSchedule";

function OverallList({ recs }: { recs: WeekRecs }) {
  const orderedRecs = DAY_ORDER.flatMap((day) => recs.overall.filter((rec) => rec.day === day));

  if (orderedRecs.length === 0) {
    return <p className="recommendations-empty-copy">No schedule returned for this week.</p>;
  }

  return (
    <section className="recommendations-section">
      <h3>Overall Plan</h3>

      <div className="overall-list">
        <div className="overall-header" aria-hidden="true">
          <span>Day</span>
          <span>Activity / Category</span>
          <span>Facility</span>
          <span>Best Time</span>
          <span>Alternate Time</span>
        </div>

        {orderedRecs.map((rec, index) => (
          <div
            className="overall-row"
            key={`${rec.day}-${rec.category}-${rec.facility}-${rec.time}-${index}`}
          >
            <span className="rec-day">{rec.day}</span>
            <span className="rec-activity">{rec.category}</span>
            <span>{rec.facility}</span>
            <time>{rec.time}</time>
            <time>{getAlternateTime(recs, rec) || "None"}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryGroup({ category }: { category: CategoryRec }) {
  return (
    <details className="category-group">
      <summary>{category.category}</summary>

      <div className="category-days">
        {category.days.map((day) => (
          <section className="category-day" key={`${category.category}-${day.day}`}>
            <h4>{day.day}</h4>

            <ul>
              {day.facilities.map((facility) => (
                <li key={`${category.category}-${day.day}-${facility.facility}`}>
                  <span>{facility.facility}</span>
                  <time>{facility.times.join(", ")}</time>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}

function CategoryList({ recs }: { recs: WeekRecs }) {
  if (recs.categories.length === 0) {
    return null;
  }

  return (
    <section className="recommendations-section">
      <h3>By Activity Or Category</h3>

      <div className="category-list">
        {recs.categories.map((category) => (
          <CategoryGroup category={category} key={category.category} />
        ))}
      </div>
    </section>
  );
}

const RecommendationWeekView = ({ recs }: { recs: WeekRecs }) => {
  return (
    <div className="recommendations-content">
      <OverallList recs={recs} />
      <CategoryList recs={recs} />
    </div>
  );
};

export default RecommendationWeekView;
