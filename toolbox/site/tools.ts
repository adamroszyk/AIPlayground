export interface Faq {
  q: string;
  a: string;
}

export interface ToolPage {
  slug: string;
  /** Matches data-tool in the page and the renderer in client.ts. */
  widget: "qr" | "text" | "password" | "age" | "loan";
  /** <title>, ≤ 60 chars. */
  title: string;
  /** Meta description, ≤ 155 chars. */
  description: string;
  h1: string;
  lead: string;
  nav: string;
  /** MCP tool(s) the page's chat section refers to. */
  mcpTools: string[];
  chatPrompts: string[];
  how: { heading: string; body: string }[];
  faqs: Faq[];
  related: string[];
  /** Extra caution shown under the tool (financial tools, security). */
  notice?: string;
}

export const TOOLS: ToolPage[] = [
  {
    slug: "qr-code-generator",
    widget: "qr",
    title: "Free QR Code Generator: PNG & SVG, No Signup",
    description: "Make a QR code for any link, text or Wi-Fi network. Free, no signup, no expiry, with custom colors. Download as PNG or SVG.",
    h1: "Free QR Code Generator",
    lead: "Type a link or any text, pick your colors, and download a QR code as PNG or SVG. It never expires, there is no tracking, and nothing is uploaded: the code is generated in your browser.",
    nav: "QR code",
    mcpTools: ["create_qr_code"],
    chatPrompts: ["Make a QR code for https://example.com/menu", "Create a black-on-white QR code for my Wi-Fi: network Home, password hunter2, WPA"],
    how: [
      { heading: "Static codes that never expire", body: "These are static QR codes: the content is encoded directly into the pattern. There is no redirect through our servers, so the code keeps working as long as the destination does, and nobody can switch it off or count your scans." },
      { heading: "Choosing an error-correction level", body: "Higher levels let a code survive scratches, folds or a logo placed on top, at the cost of a denser pattern. L recovers about 7% damage, M about 15%, Q about 25% and H about 30%. Use M for screens and H for printed material that will be handled." },
      { heading: "PNG or SVG?", body: "Use PNG for slides, social posts and documents. Use SVG for print: it scales to any size without blurring, so the same file works on a business card and on a poster." },
    ],
    faqs: [
      { q: "Is this QR code generator really free?", a: "Yes. There is no signup, watermark, scan limit or expiry date." },
      { q: "Do the QR codes expire?", a: "No. They are static, so the data lives in the image itself. The code works as long as the link or text it points to is still valid." },
      { q: "How do I make a Wi-Fi QR code?", a: "Enter the text WIFI:T:WPA;S:YourNetworkName;P:YourPassword;; replacing the name and password. Phone cameras on iOS and Android offer to join the network when they scan it." },
      { q: "Can I change the colors?", a: "Yes. Pick a dark foreground on a light background. Scanners need strong contrast, and a lighter foreground than background (an inverted code) is not read by every scanner." },
      { q: "How much can a QR code hold?", a: "Up to about 2,900 characters here. Shorter content makes a simpler pattern that is easier to scan, so a short URL is better than a long one." },
    ],
    related: ["password-generator", "word-counter", "age-calculator"],
  },
  {
    slug: "word-counter",
    widget: "text",
    title: "Word Counter & Character Counter, Free & Instant",
    description: "Count words, characters, sentences and paragraphs as you type, with reading time and top keywords. Free, private, runs in your browser.",
    h1: "Word Counter & Character Counter",
    lead: "Paste or type your text to see words, characters (with and without spaces), sentences, paragraphs and estimated reading time update instantly. Your text stays in your browser.",
    nav: "Word counter",
    mcpTools: ["count_text"],
    chatPrompts: ["How many words and characters are in this paragraph? <paste text>", "Is this essay under 500 words? <paste text>"],
    how: [
      { heading: "How words are counted", body: "A word is a run of letters or digits, and a contraction such as \"don't\" counts as one word. Hyphenated words such as \"well-known\" count as two, whereas some word processors count them as one, so a count here can differ slightly from Word or Google Docs." },
      { heading: "Characters, emoji and spaces", body: "Characters are counted as visible symbols, so an emoji counts once rather than as several internal units. Both the total and the count without spaces are shown, since character limits are defined either way." },
      { heading: "Reading and speaking time", body: "Reading time assumes about 238 words per minute and speaking time about 150, typical averages for adult silent reading and presentation pace. Treat them as estimates; technical text takes longer." },
    ],
    faqs: [
      { q: "Is my text uploaded or saved?", a: "No. On this page everything is computed in your browser and nothing is sent anywhere." },
      { q: "Why does my count differ from Microsoft Word or Google Docs?", a: "Tools disagree on edge cases such as hyphenated words, numbers and symbols standing alone. Check which rule your assignment or platform uses." },
      { q: "Does it work for Chinese, Japanese or Thai?", a: "Word counts are not meaningful for languages written without spaces, because a whole run of characters is treated as one word. Use the character count instead." },
      { q: "How do I check a character limit for X, SMS or meta descriptions?", a: "Use the character count including spaces. Be aware that some platforms count certain characters, such as URLs or emoji, differently than the raw total." },
      { q: "Why would I use this inside an AI chat?", a: "Language models cannot count reliably. They routinely get word and character counts wrong, so the chat connector does the counting exactly and returns the result." },
    ],
    related: ["qr-code-generator", "password-generator", "age-calculator"],
  },
  {
    slug: "password-generator",
    widget: "password",
    title: "Strong Password Generator: Secure & Random, Free",
    description: "Generate strong random passwords with the length and characters you choose. Uses your browser's secure random generator. Nothing is sent or stored.",
    h1: "Strong Password Generator",
    lead: "Create a random password of 4 to 128 characters using your browser's cryptographically secure random number generator. It is created on your device and never sent or stored.",
    nav: "Password generator",
    mcpTools: ["generate_password"],
    chatPrompts: ["Generate a 24-character password with no symbols", "Make me a strong password without look-alike characters like O and 0"],
    notice: "Passwords you generate inside an AI chat appear in that conversation's history. For a password you will use for something important, generate it here on this page instead.",
    how: [
      { heading: "Why random matters", body: "Passwords people invent, and passwords an AI model writes, follow patterns that attackers guess first. This generator picks every character with a cryptographically secure random source and avoids modulo bias, so each allowed character is equally likely." },
      { heading: "What entropy tells you", body: "Entropy, in bits, estimates how many guesses an attacker needs: each extra bit doubles the work. Under 50 bits is weak, 50 to 70 is fair, 70 to 100 is strong, and above 100 is very strong. A 16-character password using all four character types is above 100 bits." },
      { heading: "Use a password manager", body: "A random password is only useful if you can store it. Save it straight into a password manager and use a different one for every account." },
    ],
    faqs: [
      { q: "Is this password generator safe to use?", a: "On this page, yes: passwords are created in your browser with the Web Crypto API and are never transmitted or stored by us. You can verify that by loading the page offline." },
      { q: "How long should my password be?", a: "At least 16 characters for important accounts. Length adds more strength than complexity." },
      { q: "Should I include symbols?", a: "Symbols add strength, but some sites reject certain ones. If a site refuses the password, turn symbols off and increase the length instead." },
      { q: "What does 'exclude ambiguous characters' do?", a: "It removes look-alikes such as O and 0, or l and 1, which helps if you will ever read or type the password by hand." },
      { q: "Should I ask an AI chatbot to make a password?", a: "Only through a tool that calls a real random generator, like this connector. A model writing a password itself is not random, and the result stays in your chat history." },
    ],
    related: ["qr-code-generator", "word-counter", "age-calculator"],
  },
  {
    slug: "age-calculator",
    widget: "age",
    title: "Age Calculator & Days Between Dates, Free",
    description: "Calculate exact age in years, months and days, or the days between two dates, with weekdays and next-birthday countdown. Free and instant.",
    h1: "Age Calculator & Date Difference",
    lead: "Enter a birth date to get an exact age in years, months and days, plus total days lived and the countdown to the next birthday. Or switch to the date difference to count days, weeks and weekdays between any two dates.",
    nav: "Age & date calculator",
    mcpTools: ["calculate_age", "date_math"],
    chatPrompts: ["How old is someone born on 1990-05-15, in years, months and days?", "How many days are there between 2025-03-01 and 2025-12-25, and how many are weekdays?"],
    how: [
      { heading: "How age is calculated", body: "Age is the count of whole years, then whole months, then remaining days since the birth date, using real calendar month lengths. That matches how age is normally stated, and it avoids the errors of dividing days by 365." },
      { heading: "Leap-day birthdays", body: "For someone born on 29 February, the next birthday in a non-leap year is shown as 28 February. Some jurisdictions use 1 March instead; the legal rule varies by country." },
      { heading: "Counting days between dates", body: "The difference counts the days from the start date up to, but not including, the end date, unless you choose to include both ends. Weekdays are Monday to Friday and do not account for public holidays." },
    ],
    faqs: [
      { q: "How do I calculate my exact age?", a: "Enter your birth date, and the result shows years, months and days as of today, or as of any date you choose." },
      { q: "How many days between two dates?", a: "Use the date difference mode. It returns total days, weeks plus remaining days, and the number of weekdays." },
      { q: "Does the 'days between dates' count include the end date?", a: "By default no: 1 January to 2 January is 1 day. Tick the include-both-days option for an inclusive count, which is common for hotel stays and project timelines." },
      { q: "Can it handle leap years?", a: "Yes. Leap years and the real length of each month are built in." },
      { q: "Why use a tool for this inside an AI chat?", a: "Date arithmetic is something language models often get wrong. The connector computes it exactly from the calendar." },
    ],
    related: ["loan-calculator", "word-counter", "qr-code-generator"],
  },
  {
    slug: "loan-calculator",
    widget: "loan",
    title: "Mortgage & Loan Payment Calculator with Extra Payments",
    description: "Calculate monthly mortgage or loan payments, total interest and a yearly amortization summary. Add taxes, insurance and extra payments.",
    h1: "Mortgage & Loan Payment Calculator",
    lead: "Enter the loan amount, interest rate and term to see the monthly payment, total interest and a year-by-year breakdown. Add property tax, insurance, HOA or extra monthly payments to see how much time and interest they save.",
    nav: "Loan calculator",
    mcpTools: ["calculate_loan_payment"],
    chatPrompts: ["What is the monthly payment on a $350,000 mortgage at 6.75% over 30 years?", "How much interest would I save by paying an extra $200 a month on a $300k, 30-year loan at 6.5%?"],
    notice: "For general information only. Results are estimates for a fixed-rate loan and are not financial advice or a quote. Your lender's figures, which may include fees, mortgage insurance and rounding differences, will govern.",
    how: [
      { heading: "The formula", body: "For a fixed-rate loan, the monthly payment is fixed so that the balance reaches zero at the end of the term. Early payments are mostly interest and later ones mostly principal, which the yearly table shows." },
      { heading: "What is and is not included", body: "Principal and interest come from the standard fixed-rate formula. Property tax, insurance and HOA are added on top as monthly amounts you enter. Private mortgage insurance, closing costs, adjustable rates and escrow changes are not modelled." },
      { heading: "How extra payments help", body: "An extra monthly payment goes entirely to principal, so the balance falls faster, less interest accrues, and the loan finishes earlier. The calculator shows the months and interest saved against the plain schedule." },
    ],
    faqs: [
      { q: "How is a monthly mortgage payment calculated?", a: "With the fixed-rate amortization formula: payment = P × r ÷ (1 − (1 + r)^−n), where P is the amount borrowed, r the monthly rate (annual rate ÷ 12) and n the number of monthly payments." },
      { q: "Does this include taxes and insurance?", a: "Only if you enter them. Add monthly property tax, home insurance and HOA dues and they are included in the total monthly payment." },
      { q: "How much does an extra payment save?", a: "It depends on your rate and balance. Enter an extra monthly amount and the calculator shows the exact months and interest saved." },
      { q: "Does it work for car loans and personal loans?", a: "Yes, for any fixed-rate loan with equal monthly payments. Leave the tax, insurance and HOA fields at zero." },
      { q: "Can it handle adjustable-rate mortgages?", a: "No. It assumes the rate stays the same for the whole term." },
    ],
    related: ["age-calculator", "word-counter", "password-generator"],
  },
];

export const bySlug = (slug: string) => TOOLS.find((t) => t.slug === slug)!;
