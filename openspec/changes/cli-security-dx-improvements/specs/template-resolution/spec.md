## ADDED Requirements

### Requirement: Deterministic template resolution

Template resolution SHALL follow a predictable, documented order without walking up 8 directory levels.

#### Scenario: template found in env dir

- **WHEN** `CAATINGA_TEMPLATES_DIR` is set and contains the template
- **THEN** the template is resolved from that directory first

#### Scenario: template in packaged location

- **WHEN** no env var is set and the template is in the CLI's `templates/` directory
- **THEN** the template is resolved from the packaged location

#### Scenario: debug output via logger

- **WHEN** `CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1`
- **THEN** resolution debug output uses the logger (not raw `process.stderr`)
