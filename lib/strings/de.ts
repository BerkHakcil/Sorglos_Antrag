// Central module for all static German UI strings.
// The developer does not read German; every user-facing German phrase lives here
// so the co-founder can review and update copy in one place.
// Questionnaire content (questions, options, help texts) stays in the DB.

export const de = {
  brand: {
    name: 'Sorglos Antrag',
    tagline: 'Heimkosten einfach geregelt.',
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

    // Shown below the heading to clarify whose data the form collects.
    clarificationNote:
      'Die folgenden Angaben betreffen Sie als betreuende Person (z. B. Sohn, Tochter oder Ehepartner) – nicht den pflegebedürftigen Angehörigen.',

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
          'Ich bestätige, dass ich berechtigt bin, diesen Antrag für den pflegebedürftigen Angehörigen zu stellen, und ermächtige Hilfe zur Pflege, in meinem Namen gegenüber dem Sozialamt zu handeln.',
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
      generic: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.',
    },
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
    subheading: 'Mein Hilfe zur Pflege Antrag',
    logoutButton: 'Abmelden',
    caseIdLabel: 'Fall-ID',
    plzLabel: 'PLZ vor Heimeinzug',
    statusLabel: 'Status',

    careHome: {
      heading: 'Schritt 1: Pflegeheim auswählen',
      label: 'Pflegeheim',
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
      unsupportedNotice:
        'Für diese Postleitzahl konnte kein zuständiges Sozialamt ermittelt werden. ' +
        'Das Team wird sich mit Ihnen in Verbindung setzen.',
    },

    questionnaire: {
      patientBannerTitle: 'Angaben zur pflegebedürftigen Person',
      patientBannerBody:
        'Die folgenden Fragen beziehen sich ausschließlich auf die Person, die im Pflegeheim lebt, sie ist der Antragsteller.',
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

    chat: {
      stepLabel: 'Schritt 3: Fragebogen ausfüllen',
      nextButton: 'Weiter',
      skipButton: 'Weiß ich gerade nicht',
      savingButton: 'Speichern …',
      editButton: 'Bearbeiten',
      editSaveButton: 'Änderung speichern',
      editCancelButton: 'Abbrechen',
      reaskNote: 'Diese Frage haben Sie übersprungen. Bitte beantworten Sie sie jetzt.',
      longTextHint: 'Shift + Enter zum Absenden',
      // {answered} and {total} are replaced at render time
      progressLabel: '{answered} von {total} Fragen beantwortet',
      allAnsweredHeading: 'Sie haben alle Fragen beantwortet!',
      allAnsweredMessage:
        'Wir prüfen nun alle Ihre Angaben und übertragen diese in das Antragsformular. ' +
        'Sofern Dinge unklar sind, melden wir uns bei Ihnen.',
      editLockedMessage:
        'Der Antrag wurde zur Prüfung eingereicht. Änderungen sind nicht mehr möglich.',
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
        generic: 'Ungültige Eingabe.',
      },
    },
  },
} as const
