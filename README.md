# generic-qa-test

Test any website using a URL (link) or a local HTML file.

## What this project helps you do

You can quickly validate a web page in two common ways:

1. **Live URL testing** (for public or staging sites)
2. **Local HTML testing** (for pages not deployed yet)

---

## Flowchart 1: Test a live website URL

```mermaid
flowchart TD
    A[Start] --> B[Enter website URL]
    B --> C{URL reachable?}
    C -- No --> D[Fix DNS/network/server issue]
    D --> B
    C -- Yes --> E[Run QA checks]
    E --> F{Any issues found?}
    F -- Yes --> G[Log bug with steps and screenshot]
    G --> H[Developer fixes issue]
    H --> E
    F -- No --> I[Mark test as passed]
    I --> J[End]
```

### Real-life example

A QA engineer tests `https://shop.example.com` before a sale event:
- Verifies homepage load speed
- Checks product search
- Adds an item to cart and completes checkout
- Confirms order confirmation page appears

---

## Flowchart 2: Test a local HTML file

```mermaid
flowchart TD
    A[Start] --> B[Open local HTML file]
    B --> C{Page renders correctly?}
    C -- No --> D[Fix HTML/CSS/JS errors]
    D --> B
    C -- Yes --> E[Run functional checks]
    E --> F{Meets expected behavior?}
    F -- No --> G[Update code and retest]
    G --> B
    F -- Yes --> H[Ready for deployment]
    H --> I[End]
```

### Real-life example

A student builds a portfolio page in `index.html`:
- Opens the file in a browser
- Checks mobile responsiveness with dev tools
- Verifies contact form validation messages
- Fixes layout issues before uploading to hosting
