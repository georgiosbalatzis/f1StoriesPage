# Sample Blog Structure & Blog Post Creation Guide

## Blog Folder Structure

```
/blog-entries/
    /20250524/                      # Format: YYYYMMDD
        miami-gp-review.txt         # Blog post content
        1.jpg                       # Entry thumbnail image
        2.jpg                       # Background/header image
    /20250518/
        ferrari-comeback.txt
        1.jpg
        2.jpg
    ... etc.
```

## Example Blog Post Content (Text Format)

Here's a sample blog post file (miami-gp-review.txt):

```
Miami GP: The Good, The Bad, and The Unexpected

The Miami Grand Prix delivered drama from start to finish with surprising performances, strategic battles, and unexpected podium finishes. Here's our comprehensive analysis of what went down in Florida this past weekend.

## The Good: Strategic Masterclass from McLaren

McLaren's race strategy in Miami couldn't have been executed better. Opting for a longer first stint on the hard tires, both Norris and Piastri managed to preserve their rubber while maintaining competitive pace. This decision allowed them to switch to softs later in the race when other teams were struggling with tire degradation.

> "We knew the track temperature would drop towards the end of the race, and that's exactly when we wanted to be on the softer compound. The team executed the plan perfectly." - Lando Norris

Norris's charge through the field in the final 15 laps was nothing short of spectacular, overtaking four cars to secure a podium position that seemed impossible after qualifying. This result marks McLaren's third consecutive podium and firmly establishes them as contenders in the constructor's championship.

## The Bad: Ferrari's Reliability Issues Continue

Just when Ferrari seemed to have turned a corner with their performance, reliability issues struck again. Charles Leclerc's power unit problems began during practice sessions, but the team opted to continue with the same engine rather than take a grid penalty for a replacement.

This decision proved costly when Leclerc was forced to retire on lap 42 while running in a strong fourth position. The frustration was evident as the Monegasque driver removed his steering wheel with uncharacteristic force before walking back to the pits.

Team Principal Frederic Vasseur confirmed post-race that they would be investigating the issue thoroughly before the next race: "We need to understand exactly what happened. This is unacceptable at this stage of our development."

## The Unexpected: Alonso's Renaissance Continues

At 43 years old, Fernando Alonso continues to defy expectations. Starting from P8, few would have predicted the Aston Martin driver would find himself fighting for a podium position. Yet, through a combination of flawless driving, opportunistic overtaking, and excellent tire management, the Spaniard secured an impressive P4 finish, just 1.2 seconds behind Norris's McLaren.

This result marks Alonso's fifth top-five finish this season, putting him ahead of both Ferrari drivers in the championship standings - a scenario that would have seemed impossible at the start of the season.

> "Age is just a number. Experience counts for everything in changing conditions like we had today." - Fernando Alonso

## Race Implications for the Championship

With Verstappen taking another win, his championship lead extends to 42 points, but the battle behind him is intensifying. McLaren's consistent performance has moved them to within 15 points of Ferrari in the constructor's standings, while Mercedes seems to be finally finding pace with their recent upgrades.

The midfield battle is equally fascinating, with Aston Martin, Alpine, and Williams separated by just 12 points. The development race is heating up as we head into the European leg of the season, and teams are bringing significant upgrades to their cars.

As the circus heads to Imola for the Emilia Romagna Grand Prix, all eyes will be on Ferrari to see if they can bounce back at their home race and stop the McLaren momentum.

#Miami GP #McLaren #Ferrari #Alonso #Race Analysis
```

## How to Create a New Blog Post

1. **Create a new folder** with today's date in YYYYMMDD format (e.g., 20250530)

2. **Create your content file** (either .txt or .docx)
    - The first line will be used as the title
    - Use Markdown formatting for text documents:
        - `## Heading` for section headings
        - `> Quote text` for quotations
        - `#tag1 #tag2` at the end for categories/tags

3. **Prepare two images**:
    - `1.jpg` - Square or 16:9 thumbnail image (shown in blog preview cards)
    - `2.jpg` - Wide format header image (shown at the top of the article)

4. **Run the blog processor script**:
   ```
   node blog-processor.js
   ```

5. **Check generated files**:
    - Updated `blog-data.json` with your new post
    - New HTML file in the `/blog` directory with your slug

## Formatting Guidelines

- Keep paragraphs short and concise
- Use section headings to break up long content
- Include quotes where relevant
- End with relevant tags (prefixed with #)
- Keep image sizes reasonable (max 1-2MB per image)

## Example of Running the Processor

```bash
$ node blog-processor.js
Blog entries directory: /var/www/html/blog-entries
Found 5 blog entry folders
Processing folder: 20250524
Reading file: miami-gp-review.txt
Generated blog post: miami-gp-review.html
Processing folder: 20250518
Reading file: ferrari-comeback.txt
Generated blog post: ferrari-comeback.html
...
Blog data saved to /var/www/html/blog-data.json
Blog processing complete
```