# AI Data Analyzer PNG assets

| File                                      | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `project-icon-original.png`               | Preserved high-resolution transparent generated source        |
| `../frontend/public/project-icon.png`     | 512×512 transparent project icon for portfolio/project covers |
| `../frontend/public/project-icon-128.png` | Optimized app-shell mark                                      |
| `../frontend/public/favicon.png`          | 32×32 browser icon                                            |

The new mark was produced with the **built-in ImageGen tool**, then alpha-trimmed and resized with Chrome Canvas. The original is preserved; resizing changes neither its meaning nor its colors. It is a raster PNG, not an editable vector master.

Generation brief: “Create a polished standalone transparent PNG app mark for AI Data Analyzer, a tabular-data analysis workbench by Rather Builds. Three precise vertical data strips of ascending height joined by a rising negative-space cut, suggesting an abstract A and a step from raw data to insight. Deep forest #192C28, muted sage #CBD9BF and a small muted copper #B65C3D accent. Strong small-size silhouette, geometric edges, centered square composition, transparent background. No text, brain, neural nodes, sparkles, watermark or enclosing background tile.”

The interface palette uses explicit CSS colors; the generated image has its own raster shading. UI charts, tables, text and controls are real code rather than flattened screenshots.

To use the project PNG in a portfolio, upload `frontend/public/project-icon.png` as the project image. Keep `object-fit: contain` and a balanced square frame so the mark is not stretched or cropped. The README deliberately displays it at 96px, rather than at its full source resolution.
