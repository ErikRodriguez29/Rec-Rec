# Example commands for running recommend-times.py

**run `python recommend-times.py -h` for the help menu**

### 1. squash, cardio, all days 6–11, Tue 10–12 & Sat 9–12 blocked, rain hard filter, no preferred-facility hard filter.

`python recommend-times.py --preferred-activities squash --preferred-exercise-categories cardio --preferred-days-hours "m; 6, 11; t; 6, 11; w; 6, 11; r; 6, 11; f; 6, 11; s; 6, 11; u; 6, 11" --unavailable-days-hours "t; 10, 12; s; 9, 12" --preferred-facilities-hard-filter no --rain-filter yes`

### 2. Same schedule and filters; only --preferred-activities (no categories).

`python recommend-times.py --preferred-activities squash --preferred-days-hours "m; 6, 11; t; 6, 11; w; 6, 11; r; 6, 11; f; 6, 11; s; 6, 11; u; 6, 11" --unavailable-days-hours "t; 10, 12; s; 9, 12" --rain-filter yes`

### 3. Several activities (climbing, badminton, weight lifting, bike machines) plus several exercise categories (arms, legs, core, cardio).

`python recommend-times.py --preferred-activities "climbing,badminton,weight lifting,bike machines" --preferred-exercise-categories "arms,legs,core,cardio" --preferred-days-hours "m; 6, 11; t; 6, 11; w; 6, 11; r; 6, 11; f; 6, 11; s; 6, 11; u; 6, 11" --unavailable-days-hours "t; 10, 12; s; 9, 12" --rain-filter yes`

### 4. Exercise categories only, hard rain filter (rain-filter yes), (arms, weight training), all days 6–11, Tue 10–12 & Sat 9–12 blocked, no preferred-facility hard filter.

`python recommend-times.py --preferred-exercise-categories "arms,weight training" --preferred-days-hours "m; 6, 11; t; 6, 11; w; 6, 11; r; 6, 11; f; 6, 11; s; 6, 11; u; 6, 11" --unavailable-days-hours "t; 10, 12; s; 9, 12" --rain-filter yes`

### 5. Turn off rain as a hard filter (rain-filter no), squash, cardio, all days 6–11, Tue 10–12 & Sat 9–12 blocked, no preferred-facility hard filter.

`python recommend-times.py --preferred-activities squash --preferred-exercise-categories cardio --preferred-days-hours "m; 6, 11; t; 6, 11; w; 6, 11; r; 6, 11; f; 6, 11; s; 6, 11; u; 6, 11" --unavailable-days-hours "t; 10, 12; s; 9, 12" --rain-filter no`
