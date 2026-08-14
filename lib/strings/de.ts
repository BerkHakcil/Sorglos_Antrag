// Central module for all static German UI strings.
// The developer does not read German; every user-facing German phrase lives here
// so the co-founder can review and update copy in one place.
// Questionnaire content (questions, options, help texts) stays in the DB.

export const de = {
  brand: {
    name: 'Sorglos Antrag',
    // tagline moved to DB (static_content 'brand.tagline') — CLAUDE.md rule #2
  },

  login: {
    errors: {
      emailNotConfirmed:
        'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Überprüfen Sie Ihr Postfach.',
    },
  },

  resetPassword: {
    pageTitle: 'Passwort zurücksetzen – Hilfe zur Pflege',
    heading: 'Passwort zurücksetzen',
    subheading: 'Wir senden Ihnen einen Link, mit dem Sie Ihr Passwort neu festlegen können.',
    emailLabel: 'E-Mail-Adresse',
    submitIdle: 'Link zum Zurücksetzen senden',
    submitPending: 'Senden…',
    backToLogin: 'Zurück zur Anmeldung',
    successMessage:
      'Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir Ihnen eine E-Mail zugesandt.',
    errors: {
      emailRequired: 'E-Mail-Adresse ist erforderlich.',
      generic: 'Fehler beim Senden der E-Mail. Bitte versuchen Sie es erneut.',
    },
  },

  updatePassword: {
    pageTitle: 'Neues Passwort – Hilfe zur Pflege',
    heading: 'Neues Passwort festlegen',
    subheading: 'Geben Sie Ihr neues Passwort ein.',
    newPasswordLabel: 'Neues Passwort',
    passwordHint: 'Mindestens 8 Zeichen',
    confirmPasswordLabel: 'Passwort bestätigen',
    submitIdle: 'Passwort speichern',
    submitPending: 'Speichern…',
    errors: {
      allRequired: 'Alle Felder sind erforderlich.',
      passwordLength: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
      passwordMismatch: 'Die Passwörter stimmen nicht überein.',
      generic: 'Passwort konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.',
    },
  },

  signup: {
    pageTitle: 'Registrieren – Hilfe zur Pflege',
    heading: 'Konto erstellen',
    subheading: 'Erstellen Sie ein Konto, um Ihren Antrag auf Hilfe zur Pflege zu stellen.',

    fields: {
      firstName: 'Vorname',
      lastName: 'Nachname',
      // Phone is required; no "(optional)" suffix.
      phone: 'Telefonnummer',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      passwordHint: 'Mindestens 8 Zeichen',
    },

    consents: {
      // Checkbox 1 — Datenschutz acknowledgment (separate from AGB).
      datenschutz: {
        prefix: 'Ich habe die ',
        linkText: 'Datenschutzerklärung',
        suffix: ' zur Kenntnis genommen.',
      },

      // Checkbox 2 — AGB agreement.
      agb: {
        prefix: 'Ich habe die ',
        linkText: 'Allgemeinen Geschäftsbedingungen',
        suffix: ' gelesen und stimme ihnen zu.',
      },

      // Checkbox 3 — data processing.
      dataProcessing: {
        label:
          'Ich stimme der Verarbeitung meiner personenbezogenen Daten zur Bearbeitung meines Antrags zu.',
        infoTriggerLabel: 'Mehr Informationen zur Datenverarbeitung',
        infoText:
          'Ihre Daten werden ausschließlich zur Bearbeitung Ihres Antrags auf Hilfe zur Pflege gespeichert und verarbeitet. Wir geben Ihre Daten nicht an Dritte weiter, außer an das zuständige Sozialamt im Rahmen Ihrer Antragstellung.',
      },

      // Checkbox 3 — authority to act.
      authorityToAct: {
        label:
          'Ich bestätige, dass ich berechtigt bin, diesen Antrag für den pflegebedürftigen Angehörigen zu stellen, und ermächtige Sorglos Antrag, in meinem Namen gegenüber dem Sozialamt zu handeln.',
        infoTriggerLabel: 'Mehr Informationen zur Vollmacht',
        infoText:
          'Diese Vollmacht erlaubt uns, Ihren Antrag beim zuständigen Sozialamt einzureichen und etwaige Rückfragen stellvertretend für Sie zu bearbeiten. Die Vollmacht beschränkt sich auf die Antragstellung und ist jederzeit widerrufbar.',
      },
    },

    submitIdle: 'Registrieren',
    submitPending: 'Registrieren …',

    haveAccount: 'Bereits registriert?',
    loginLink: 'Anmelden',

    successMessage:
      'Bitte bestätigen Sie Ihre E-Mail-Adresse. Wir haben Ihnen eine E-Mail zugesandt.',

    // ── Validation errors ──────────────────────────────────
    // co-founder to confirm all copy below
    errors: {
      // Per-field messages shown inline or as the top-level action error.
      firstNameRequired: 'Bitte geben Sie Ihren Vornamen an.',
      lastNameRequired: 'Bitte geben Sie Ihren Nachnamen an.',
      phoneRequired: 'Bitte geben Sie eine Telefonnummer an.',
      phoneInvalid: 'Bitte geben Sie eine gültige Telefonnummer ein.',
      emailInvalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      // Generic "this field is required" — used for browser setCustomValidity on email/password.
      fieldRequired: 'Pflichtfeld.',
      passwordLength: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
      // Shown when fewer than all four consent checkboxes are checked.
      consents: 'Bitte akzeptieren Sie alle Bedingungen, um sich zu registrieren.',
      // Supabase-level errors — mapped from raw Supabase Auth error messages.
      emailTaken: 'Diese E-Mail-Adresse ist bereits registriert.',
      // co-founder to confirm
      rateLimitError: 'Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.',
      // SMTP send failure (2026-07-20 Brevo incident). The account is rolled back
      // when the email fails, so "noch nicht erstellt / später erneut" is accurate.
      // PLACEHOLDER pending Roman.
      emailSendFailure:
        'Die Bestätigungs-E-Mail konnte derzeit nicht versendet werden. Ihr Konto wurde noch nicht erstellt — bitte versuchen Sie es später erneut.',
      generic: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
    },
  },

  // App-wide legal footer (post-Batch-C mini round). The three labels are the
  // founder's own wording from the brief ("Impressum · Datenschutz · AGB") —
  // standard legal page names, not creative copy; no PLACEHOLDER_DE.
  footer: {
    impressum: 'Impressum',
    datenschutz: 'Datenschutz',
    agb: 'AGB',
  },

  agb: {
    pageTitle: 'AGB – Hilfe zur Pflege',
    heading: 'Allgemeine Geschäftsbedingungen',
    body: 'Die vollständigen Allgemeinen Geschäftsbedingungen werden in Kürze veröffentlicht.',
    backLink: 'Zurück zur Registrierung',
  },

  datenschutz: {
    pageTitle: 'Datenschutzerklärung – Hilfe zur Pflege',
    heading: 'Datenschutzerklärung',
    body: 'Die vollständige Datenschutzerklärung wird in Kürze veröffentlicht.',
    backLink: 'Zurück zur Registrierung',
  },

  case: {
    pageTitle: 'Mein Antrag – Sorglos Antrag',
    heading: 'Mein Antrag',
    // subheading moved to DB (static_content 'case.subheading') — CLAUDE.md rule #2
    logoutButton: 'Abmelden',
    plzLabel: 'PLZ vor Heimeinzug',
    statusLabel: 'Status',

    careHome: {
      heading: 'Schritt 1: Pflegeheim auswählen',
      // Roman's copy (Essen CSV row 1) — shared pre-questionnaire UI, so Berlin
      // users see it too.
      label: 'In welches Pflegeheim sind Sie eingezogen?',
      placeholder: 'Bitte wählen Sie ein Pflegeheim aus',
      submitButton: 'Pflegeheim bestätigen',
      loadingButton: 'Wird gespeichert …',
      errorGeneric: 'Auswahl konnte nicht gespeichert werden. Bitte erneut versuchen.',
    },

    plz: {
      heading: 'Schritt 2: Postleitzahl des letzten Wohnortes',
      description:
        'Bitte geben Sie die Postleitzahl der Wohnung an, in der die pflegebedürftige Person ' +
        'zuletzt gelebt hat (vor dem Einzug ins Pflegeheim).',
      label: 'Postleitzahl (5 Ziffern)',
      placeholder: 'z. B. 10115',
      submitButton: 'Postleitzahl bestätigen',
      loadingButton: 'Wird geprüft …',
      errorInvalidFormat: 'Bitte geben Sie eine gültige 5-stellige Postleitzahl ein.',
      errorGeneric: 'Fehler beim Speichern. Bitte erneut versuchen.',
      // Currently NOT rendered (CP3/D12: unresolved PLZs proceed normally in the
      // Berlin questionnaire; the old copy promised a team follow-up). New copy
      // pending Roman review before the notice returns.
      unsupportedNotice:
        'Für diese Postleitzahl konnte kein zuständiges Sozialamt ermittelt werden. ' +
        'Das Team wird sich mit Ihnen in Verbindung setzen.',
    },

    questionnaire: {
      // patientBannerTitle/Body moved to DB (static_content 'case.patient_banner_*') — CLAUDE.md rule #2
      requiredBadge: 'Pflichtfeld',
      optionalBadge: 'Optional',
      groupEmptyHint:
        'Noch keine Einträge vorhanden. Das Hinzufügen folgt in einem späteren Schritt.',
      repeatableGroupLabel: 'Wiederholbare Gruppe',
    },

    statusLabels: {
      in_progress: 'In Bearbeitung',
      under_review: 'In Prüfung',
      completed: 'Fragebogen vollständig',
    } as Record<string, string>,

    // Tab switcher (feedback pass item 2). Trivial UI words — pending-Roman
    // pro forma.
    tabs: {
      // R2-1 (UI round 2, D4): the mockup's nav wording. Approved by Erman
      // 2026-08-14, Roman review waived. The docs.* pane rows deliberately
      // keep Roman's "Dokumente" vocabulary (F5) — the mismatch is on the
      // ledger for him to harmonize if he ever cares.
      questions: 'Angaben',
      documents: 'Unterlagen',
      // E-2 badge word ("· 4 offen") — approved by Erman 2026-08-13, Roman
      // review waived (item-3 waiver).
      badgeOpenWord: 'offen',
    },

    // Pass 4 / D11 — the Hilfe contact sheet. Visible strings come from
    // static_content (contact.*); only the close button's screen-reader
    // label lives here. Approved by Erman 2026-08-13, Roman review waived.
    help: {
      closeLabel: 'Schließen',
    },

    chat: {
      stepLabel: 'Schritt 3: Fragebogen ausfüllen',
      // R2-3 (UI round 2, D4): the mockup's wording. Approved by Erman
      // 2026-08-14, Roman review waived. Both selectors were moved onto
      // testids in R2-0 precisely so this rename touches no test.
      nextButton: 'Antwort speichern',
      skipButton: 'Später beantworten',
      savingButton: 'Speichern …',
      editButton: 'Bearbeiten',
      editSaveButton: 'Änderung speichern',
      editCancelButton: 'Abbrechen',
      reaskNote: 'Diese Frage haben Sie übersprungen. Bitte beantworten Sie sie jetzt.',
      longTextHint: 'Shift + Enter zum Absenden',
      // {answered} and {total} are replaced at render time
      progressLabel: '{answered} von {total} Fragen beantwortet',
      // allAnsweredHeading/Message moved to DB (static_content 'case.all_answered_*') — CLAUDE.md rule #2
      // locked-banner heading/body moved to DB (static_content 'case.locked_*') — CLAUDE.md rule #2
      skippedBadge: 'Übersprungen',

      repeatableGroup: {
        // {group} is replaced with the group label (e.g. "Rente / Pension")
        anotherPrompt: 'Möchten Sie eine weitere {group} hinzufügen?',
        yesButton: 'Ja, hinzufügen',
        noButton: 'Nein, weiter',
        removeInstanceLabel: 'Eintrag entfernen',
        // {group} and {index} replaced at render time
        instanceLabel: '{group} {index}',
      },

      // Pass 4 / D15 — confirm-and-clear when a count-driven group's count is
      // DECREASED below the number of filled instances. Copy = the
      // roman_package_pass4.md §4 proposal, approved as proposed by Erman
      // 2026-08-01 (Roman review waived) — final, verbatim.
      countDecrease: {
        title: 'Angaben löschen?',
        body: 'Sie haben die Anzahl der Renten verringert. Die Angaben zu den überzähligen Renten werden dabei gelöscht.',
        confirmButton: 'Ja, löschen',
        cancelButton: 'Abbrechen',
      },

      errors: {
        generic: 'Antwort konnte nicht gespeichert werden. Bitte erneut versuchen.',
        editLocked: 'Der Antrag ist bereits zur Prüfung eingereicht.',
      },

      validationErrors: {
        required: 'Dieses Feld ist erforderlich.',
        // {min} / {max} replaced at runtime
        minLength: 'Mindestens {min} Zeichen erforderlich.',
        maxLength: 'Höchstens {max} Zeichen erlaubt.',
        invalidDate: 'Ungültiges Datum.',
        invalidNumber: 'Bitte eine gültige Zahl eingeben.',
        invalidYesNo: 'Bitte Ja oder Nein auswählen.',
        invalidSelect: 'Bitte eine gültige Option auswählen.',
        invalidAddress: 'Bitte Straße, Postleitzahl und Ort angeben.',
        invalidPerson: 'Bitte Vorname und Nachname angeben.',
        invalidIban: 'Bitte eine gültige IBAN eingeben.',
        // Generic validation.pattern failure (BIC/IBAN/PLZ etc.) — Roman-approved wording
        invalidFormat: 'Ungültiges Format.',
        generic: 'Ungültige Eingabe.',
      },
    },
  },
  // ── E-7 additions — FINAL COPY: approved by Erman 2026-08-13, Roman
  // review waived (item-3 waiver). Ledgered in german_copy_for_roman.md;
  // any later rewording by Roman is a one-line de.ts edit.
  loading: {
    // sr-only text on the route-loading spinner
    label: 'Wird geladen …',
  },
  notFound: {
    pageTitle: 'Seite nicht gefunden – Hilfe zur Pflege',
    heading: 'Seite nicht gefunden',
    body: 'Diese Seite gibt es nicht oder sie wurde verschoben.',
    backLink: 'Zu meinem Antrag',
  },
} as const
