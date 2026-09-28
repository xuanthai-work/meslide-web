import type { Catalog } from "../types";

/**
 * English message catalog. This is the canonical key shape: the Vietnamese
 * catalog ({@link ./vi.ts}) must expose the same keys. Catalog parity is
 * enforced by `tests/i18n-catalogs.test.mjs`.
 *
 * Keys are semantic and grouped by feature, independent of the original
 * English sentence. Add new keys to BOTH catalogs in the same change.
 */
const en = {
  common: {
    actions: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      close: "Close",
      confirm: "Confirm",
      retry: "Try again",
      back: "Back",
      continue: "Continue",
      edit: "Edit",
      duplicate: "Duplicate",
      create: "Create",
      export: "Export",
      generate: "Generate",
      regenerate: "Regenerate",
    },
    status: {
      loading: "Loading…",
      saving: "Saving…",
      deleting: "Deleting…",
      duplicating: "Duplicating…",
    },
    counts: {
      // Count-dependent message (spec FR-7): never assembled with bare
      // English concatenation. Uses Intl.PluralRules via the active locale.
      slides: (_p, locale) => {
        const n = Number(_p.count);
        const cat = new Intl.PluralRules(locale).select(n);
        return cat === "one" ? "1 slide" : `${n} slides`;
      },
    },
    generation: {
      stop: "Stop",
      retry: "Try again",
      keepWaiting: "Keep waiting",
      takingLonger: "This is taking longer than usual",
      stopOutlineConfirm: (p) => `Stop generating this outline? ${p.count} section(s) already drafted will be kept.`,
      stopSlidesConfirm: (p) => `Stop generating these slides? ${p.draft} of ${p.total} slide(s) already drafted will be kept.`,
    },
    // Fallback title for a presentation with no name. Shared across dashboard,
    // outline, and export surfaces.
    untitledPresentation: "Untitled presentation",
    // Brand name — intentionally untranslated.
    brand: "GSlide",
  },

  nav: {
    dashboard: "Dashboard",
    settings: "Settings",
    themes: "Themes",
    templates: "Templates",
    help: "Help",
    helpAria: "Email GSlide help",
    logout: "Sign out",
  },

  auth: {
    title: "Sign in",
    subtitle: "Sign in to continue to GSlide",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    invalid: "Invalid username or password",
  },

  sidebar: {
    ariaLabel: "Dashboard sidebar",
    sectionsAria: "Dashboard sections",
  },

  dashboard: {
    section: {
      actions: "Actions",
      decks: "My Slides",
    },
    loading: {
      title: "Slide Presentation",
    },
    emptyState: {
      ariaLabel: "Create your first presentation",
      noPresentations: "No presentations yet.",
      getStarted: "Get started now",
    },
    actions: {
      createNew: {
        title: "Create new Presentation",
        ariaLabel: "Create new presentation",
      },
      blank: {
        title: "Blank Presentation",
        creating: "Creating…",
        ariaLabel: "Create blank presentation",
        creatingAriaLabel: "Creating blank presentation",
        errorTitle: "Could not create blank presentation",
        errorFallback: "Something went wrong while creating the presentation.",
      },
    },
    decks: {
      gridViewAria: "Grid view",
      listViewAria: "List view",
    },
    card: {
      unsupported: {
        title: "Unsupported presentation",
        // "Presenton" is the legacy product name; kept verbatim.
        description:
          "This deck was created in an older Presenton version. Downgrade to a compatible version to open it.",
      },
      unsupportedTitle: "Unsupported in this version of Presenton",
      previewUnavailable: "Preview unavailable",
      present: "Quick present",
      presentAria: "Quick present this deck",
      deleted: {
        title: "Presentation deleted",
        description: "The presentation was removed from your dashboard.",
      },
      deleteError: {
        title: "Could not delete presentation",
        fallback: "Something went wrong while deleting the presentation.",
      },
      duplicated: {
        title: "Presentation duplicated",
        description: "A copy was added to your dashboard.",
      },
      duplicateError: {
        title: "Could not duplicate presentation",
        fallback: "Something went wrong while duplicating the presentation.",
      },
      deleteDialog: {
        title: "Delete presentation?",
        body: "This will permanently delete the presentation below.",
        disclaimer: "This action cannot be undone.",
      },
    },
    legacy: {
      deleted: {
        title: "Legacy presentations deleted",
        description: (p, locale) => {
          const n = Number(p.count);
          const cat = new Intl.PluralRules(locale).select(n);
          return cat === "one"
            ? `${n} presentation was removed.`
            : `${n} presentations were removed.`;
        },
      },
      deleteError: {
        title: "Some presentations could not be deleted",
        description: "Please try again.",
      },
      title: "Legacy Presentation",
      deleteAllAria: "Delete all legacy presentations",
      notice: {
        body: "These presentations were created in an older format and can't be opened in Presenton 0.9.2-beta.",
        downloadLink: "Download Presenton v0.8.10-beta to access them",
      },
      column: {
        name: "Name",
        createdOn: "Created on",
        format: "Format",
      },
      notAccessible: "Not Accessible",
      deleteDialog: {
        title: "Delete legacy presentations?",
        body: (p) =>
          `This will permanently delete all ${p.count} legacy presentations. This action cannot be undone.`,
      },
    },
  },

  export: {
    pdfMaker: {
      noPresentationId: {
        title: "No presentation id found",
        subtitle: "Please try again",
        goHome: "Go to home",
      },
      error: {
        toastTitle: "Failed to load presentation",
        toastDesc: "The presentation could not be loaded. Please try again.",
        notFound: "Presentation not found",
        oopsTitle: "Oops!",
        message: "We encountered an issue loading your presentation.",
        suggestion: "Please check your internet connection or try again later.",
      },
    },
  },

  outline: {
    status: {
      preparing: "Preparing your presentation outline",
      analyzingTopic: "Analyzing your topic for web research",
      searchingProvider: (p) => `Searching ${p.provider} for: ${p.query}`,
      webResearchComplete: "Web research complete",
      nativeSearchDrafting: "Using search results to draft your outline",
      drafting: "Drafting your presentation outline",
      stalled: "Outline stream stalled — waiting for the server.",
      reconnecting: "Reconnecting to outline stream",
      ready: "Outline ready",
    },
    loading: {
      generatingPresentationData: "Generating presentation data…",
    },
    toast: {
      generationError: {
        title: "Generation error",
        fallbackDescription: "Error in presentation generation.",
      },
      parseFailed: {
        title: "Parse failed",
        description: "Failed to parse presentation data.",
      },
      streamingFailed: {
        title: "Outline streaming failed",
      },
      connectFailed: {
        description: "Failed to connect to the server. Please try again.",
      },
      connectionFailed: {
        title: "Connection failed",
      },
    },
  },

  documentsPreview: {
    toast: {
      readFailed: {
        title: "Could not read document",
        description: "Failed to read document content.",
      },
      creationFailed: {
        title: "Creation failed",
        fallbackDescription: "Something went wrong while creating the presentation.",
      },
    },
    loading: {
      generatingOutline: "Generating presentation outline…",
      creationError: "Error in radar presentation creation.",
    },
    content: {
      heading: "Content:",
    },
    sidebar: {
      label: {
        documents: "DOCUMENTS",
      },
      aria: {
        documentIcon: "Document icon",
      },
      fallbackFilename: "file.txt",
    },
    tooltip: {
      openPanel: "Open Panel",
    },
    button: {
      next: "Next",
    },
  },

  upload: {
    metadata: {
      title: "GSlide | AI presentation generator",
      createTitle: "Create Data Presentation | GSlide",
      description: "Turn prompts or documents into presentations with AI.",
    },
    hero: { title: "G-SLIDE", subtitle: "Turn prompts or documents into presentations with AI" },
    template: {
      label: "Template",
      loading: "Loading templates...",
      unavailable: "Select template",
      loadError: "Templates could not be loaded.",
      empty: "No templates are available yet.",
      retry: "Try again",
      dialogTitle: "Choose your look",
      dialogDescription: "Browse the designs, then choose one for your presentation.",
      carouselAria: "Template previews. Use left and right arrow keys to browse.",
      railAria: "All templates",
      choose: "Use this template",
      chooseAria: (p) => `Use ${p.name} template`,
      previewAria: (p) => `Preview ${p.name} template`,
    },
    prompt: {
      write: "Write prompt",
      placeholder: "Start with your idea... we'll handle the slides",
      sourceLabel: "Your idea",
      sourcePlaceholder: "Describe the presentation you want to create...",
      rewrite: {
        action: "Rewrite with AI",
        loading: "Rewriting...",
        phaseUploading: "Uploading documents...",
        phaseReading: "Reading documents...",
        outputLabel: "AI-optimized prompt",
        // Redesign 2026-09-16: compact empty-state heading that the panel
        // shows before the first rewrite. Kept short so the panel itself
        // does not dominate the composer before the user acts.
        emptyTitle: "No rewrite yet",
        emptyHint: "Your rewritten prompt will appear here",
        // Shown only when a fresh result was grounded in documents, with the
        // number of documents used. Not shown for prompt-only rewrites or
        // while a stored result is stale.
        groundedSummary: (p) =>
          Number(p.count) <= 1
            ? "Optimized from your idea and 1 document"
            : `Optimized from your idea and ${p.count} documents`,
        staleBadge: "Needs update",
        staleHelper: "Your idea changed since the last rewrite. Update the rewrite before creating your presentation.",
        updateAction: "Update rewrite",
        retryAction: "Try again",
        errorTitle: "Couldn't rewrite the prompt",
        errorFallback: "Something went wrong while rewriting the prompt. Try again; any previous result is kept.",
        preparationErrorFallback: "Something went wrong while preparing your documents. Check your files and try again; any previous result is kept.",
        requiredTitle: "Rewrite the prompt before creating",
        requiredDescription: "Please rewrite the prompt with AI before creating your presentation.",
        aria: {
          loading: "Rewriting your prompt with AI.",
          uploading: "Uploading your documents.",
          reading: "Reading your documents to ground the rewrite.",
          success: "Prompt rewritten successfully.",
          stale: "The rewritten prompt needs an update.",
          error: "Prompt rewrite failed.",
        },
      },
    },
    files: {
      unsupportedTitle: "Some files are not supported",
      supportedDescription: "Supported: Word, PowerPoint, spreadsheets, PDF/TXT/Markdown, and image files.",
      limitTitle: "Maximum file limit reached",
      selectedTitle: "Files selected",
      limitDescription: (p) => `You can upload up to ${p.max} documents only.`,
      addedDescription: (p) => `${p.count} file(s) have been added.`,
      removeAria: (p) => `Remove ${p.name}`,
      attachedAria: "Attached files",
      attach: "Attach files",
      attachMore: (p) => `Attach more (${p.count})`,
      generateAria: "Generate presentation",
      // Redesign 2026-09-16: section label, optional indicator, and copy
      // variants that describe how the selected files participate in the
      // rewrite and Create flows.
      sectionLabel: "Reference documents",
      optionalIndicator: "Optional",
      // Shown when the user has not attached any files yet. Concise guidance
      // for the supported formats without suggesting any document has been
      // processed.
      emptyGuidance: "Attach Word, PowerPoint, spreadsheets, PDF/TXT, or image files if you want AI to use them.",
      // Flag ON + files selected: the rewrite will read the documents.
      helperDocAware: (p) =>
        Number(p.count) <= 1
          ? "AI will use 1 document to optimize the prompt"
          : `AI will use ${p.count} documents to optimize the prompt`,
      // Flag OFF + files selected: docs are used during Create, not during
      // rewrite.
      helperPresentationOnly: (p) =>
        Number(p.count) <= 1
          ? "This document will be used when creating the presentation"
          : `${p.count} documents will be used when creating the presentation`,
    },
    config: {
      autoSlides: "Auto slides",
      slideUnit: "slide",
      slides: (p) => `${p.count} slides`,
      selectLanguage: "Select language",
      searchLanguage: "Search language...",
      noLanguage: "No language found.",
      standard: "Standard",
      imageDisabled: "Image generation disabled",
      noImageProvider: "No image provider",
      web: "Web",
      webSearch: "Web search",
      webSearchAria: "Toggle web search for this presentation",
      on: "On",
      off: "Off",
    },
    advanced: {
      title: "Advanced settings",
      subtitle: "Adjust presentation behavior",
      closeAria: "Close advanced settings",
      instructions: "Write instructions",
      instructionsPlaceholder: "Guide the AI: define audience, tone, key points, or constraints.",
      tone: "Tone",
      selectTone: "Select tone",
      verbosity: "Verbosity",
      selectVerbosity: "Select verbosity",
      tones: {
        default: "Default",
        casual: "Casual",
        professional: "Professional",
        funny: "Funny",
        educational: "Educational",
        salesPitch: "Sales pitch",
      },
      verbosityOptions: {
        concise: "Concise",
        standard: "Standard",
        textHeavy: "Text-heavy",
      },
    },
    validation: {
      languageRequiredTitle: "Language required",
      selectLanguage: "Please select a language.",
      selectLanguageForDocuments: "Please choose a language before processing uploaded documents.",
      inputRequiredTitle: "Input required",
      inputRequiredDescription: "Provide a prompt or upload a document.",
    },
    status: {
      processingDocuments: "Processing documents...",
      largeDocumentsHint: "It might take a few minutes for large documents.",
      generatingOutline: "Generating presentation outline...",
      preparingOutline: "Preparing outline generation...",
    },
    create: {
      // Redesign 2026-09-16: explicit, unambiguous text action that replaces
      // the previous icon-only button. The visible label never depends on a
      // tooltip, and the same string is used for the aria-label so the
      // keyboard shortcut announcement stays in sync.
      label: "Create presentation",
      ariaLabel: "Create presentation",
    },
    error: {
      generationTitle: "Generation failed",
      generationFallback: "Something went wrong while starting your presentation.",
    },
    language: {
      auto: "Auto (English)",
      english: "English",
      spanish: "Spanish",
      french: "French",
      german: "German",
      portuguese: "Portuguese",
      italian: "Italian",
      dutch: "Dutch",
      russian: "Russian",
      chineseSimplified: "Chinese (Simplified)",
      chineseTraditional: "Chinese (Traditional)",
      japanese: "Japanese",
      korean: "Korean",
      arabic: "Arabic",
      hindi: "Hindi",
      bengali: "Bengali",
      polish: "Polish",
      czech: "Czech",
      slovak: "Slovak",
      hungarian: "Hungarian",
      romanian: "Romanian",
      bulgarian: "Bulgarian",
      greek: "Greek",
      serbian: "Serbian",
      croatian: "Croatian",
      bosnian: "Bosnian",
      slovenian: "Slovenian",
      finnish: "Finnish",
      swedish: "Swedish",
      danish: "Danish",
      norwegian: "Norwegian",
      icelandic: "Icelandic",
      lithuanian: "Lithuanian",
      latvian: "Latvian",
      estonian: "Estonian",
      maltese: "Maltese",
      welsh: "Welsh",
      irish: "Irish",
      scottishGaelic: "Scottish Gaelic",
      ukrainian: "Ukrainian",
      hebrew: "Hebrew",
      persian: "Persian (Farsi)",
      turkish: "Turkish",
      kurdish: "Kurdish",
      pashto: "Pashto",
      dari: "Dari",
      uzbek: "Uzbek",
      kazakh: "Kazakh",
      tajik: "Tajik",
      turkmen: "Turkmen",
      azerbaijani: "Azerbaijani",
      urdu: "Urdu",
      tamil: "Tamil",
      telugu: "Telugu",
      marathi: "Marathi",
      punjabi: "Punjabi",
      gujarati: "Gujarati",
      malayalam: "Malayalam",
      kannada: "Kannada",
      odia: "Odia",
      sinhala: "Sinhala",
      nepali: "Nepali",
      thai: "Thai",
      vietnamese: "Vietnamese",
      lao: "Lao",
      khmer: "Khmer",
      burmese: "Burmese",
      tagalog: "Tagalog (Filipino)",
      javanese: "Javanese",
      sundanese: "Sundanese",
      malay: "Malay",
      mongolian: "Mongolian",
      swahili: "Swahili",
      hausa: "Hausa",
      yoruba: "Yoruba",
      igbo: "Igbo",
      amharic: "Amharic",
      zulu: "Zulu",
      xhosa: "Xhosa",
      shona: "Shona",
      somali: "Somali",
      basque: "Basque",
      catalan: "Catalan",
      galician: "Galician",
      quechua: "Quechua",
      nahuatl: "Nahuatl",
      hawaiian: "Hawaiian",
      maori: "Maori",
      tahitian: "Tahitian",
      samoan: "Samoan",
    },
  },

  chat: {
    title: "Assistant",
    assistantTitle: "AI Assistant",
    live: "Live",
    loading: "Loading chat…",
    emptyHeading: "What can I do for your deck today?",
    quickPromptsLabel: "QUICK PROMPTS",
    suggestionsLabel: "SUGGESTIONS",
    promptButton: "Prompt",
    selectedElement: "Selected element",
    activity: { planning: "Planning the next step.", reading: "Reading the relevant content.", searching: "Searching for relevant content.", opening: "Opening the selected content.", checking: "Checking the information.", generating: "Generating visual assets.", saving: "Saving changes.", applying: "Applying the change.", removing: "Removing the selected item.", completed: "Finished that step.", failed: "I could not finish that step." },
    status: { readingDeckContext: "Reading deck context", finalizingResponse: "Finalizing response", savingChat: "Saving chat" },
    trace: {
      addingOutlineSlide: "Adding an outline slide.", updatingOutlineSlide: "Updating the outline slide.", deletingOutlineSlide: "Deleting the outline slide.", addingBlankSlide: "Adding a blank slide.", addingSlideFromLayout: "Adding slide from layout.", readingTemplateSummary: "Reading template summary.",
      readingSourceDocuments: "Reading source documents.", searchingRelevantSlides: "Searching relevant slides.", openingRequestedSlide: "Opening the requested slide.", checkingAvailableLayouts: "Checking available layouts.", checkingLayoutSchema: "Reading layout content schema.", generatingSlideAssets: "Generating slide assets.",
      savingSlide: "Saving the slide.", updatingSlide: "Updating the slide.", deletingSlide: "Deleting the slide.", addingSlideElement: "Adding slide element.", updatingSlideElement: "Updating slide element.", removingSlideElement: "Removing slide element.", addingSlideComponent: "Adding slide component.", creatingSlideComponent: "Creating slide component.", updatingSlideComponent: "Updating slide component.", removingSlideComponent: "Removing slide component.",
      checkingAvailableThemes: "Checking available themes.", applyingPresentationTheme: "Applying presentation theme.", runningTool: (p) => `Running ${p.tool}.`, modelNote: "The AI is analyzing your request.", usingTools: "Choosing the best way to help.", toolFailed: "The tool step could not be completed.", toolResult: "Received a result from the tool.", toolReturnedResults: (p) => `${p.tool} returned ${p.count} result(s).`, foundRequestedData: "Found the requested information.", noMatchingData: "No matching information was found.", toolCompleted: "Finished that step.", toolLimitReached: "Reached the tool-call limit; preparing the best available summary.",
    },
    clear: "Clear chat",
    reset: "Reset chat",
    understanding: "Understanding",
    thinking: "Thinking",
    working: "Working on it…",
    whatCanIDo: "What can I do",
    placeholder: { general: "Ask anything.\nType / to get Quick prompts.", changeTitle: "Change slide 2 title", improveDesign: "Improve slide design" },
    aria: { currentSelection: "Current editor selection", removeSelection: "Remove selected element from context", removeLink: "Remove link", removeImage: "Remove pasted image", removeDocument: "Remove attached document", attach: "Attach files", quickPrompts: "Open quick prompts", stop: "Stop chat response", send: "Send prompt", focusInput: "Focus prompt input", showComparison: "Show edit comparison", hideComparison: "Hide edit comparison" },
    follow: { enable: "Enable follow AI mode", disable: "Disable follow AI mode", on: "Follow AI is on: auto-jump to active slide", off: "Follow AI is off" },
    attachment: { templateOnly: "Attachments are available in Template V2 chat.", useButton: "Use the attach button for this file.", readyTitle: "Attachment ready", failedTitle: "Could not attach file", failedFallback: "Upload failed.", pastedTitle: "Image pasted", pasteFailedTitle: "Could not paste image", pasteFailedFallback: "Image upload failed.", imageReadFailedTitle: "Could not read image", imageReadFailedFallback: "Image processing failed." },
    toast: { loadFailedTitle: "Could not load chat", loadFailedFallback: "Could not load previous chat", deleteFailedTitle: "Could not delete chat", deleteFailedFallback: "Could not delete the saved chat conversations", previewUnavailable: "Preview unavailable", presentationNotReady: "The presentation is not ready yet.", noSlides: "No slide data is available.", originalRestored: "Original restored", changesRestored: "Changes restored", restoreFailed: "Could not restore slides", tryAgain: "Please try again.", refreshFailed: "Refresh failed", mutationRefreshFailed: "Changes were saved, but refresh failed.", completionRefreshFailed: "Chat completed, but refresh failed.", errorTitle: "Chat error", sendFailed: "Failed to send chat message" },
    widgets: { working: "Working", selectEdits: "Select edits", original: "Original", modified: "Modified", change: "Change", changes: "Changes", restoreAria: (p) => `Restore ${p.version} slide state` },
    quickPrompts: { popular: "Popular", addData: "Add Data", addVisuals: "Add Visuals", structure: "Structure", refine: "Refine Content", generateFull: "Generate a full presentation from my topic", improveContent: "Improve this slide content", rewriteProfessional: "Rewrite this content professionally", addSpeakerNotes: "Add speaker notes to this slide", expandOutline: "Expand outline", shortenOutline: "Shorten outline", reorderSections: "Reorder sections", mergeSimilar: "Merge similar slides", splitLarge: "Split large sections", improveConclusion: "Improve conclusion", improveIntroduction: "Improve introduction", executiveSummary: "Create an executive summary", storyFlow: "Strengthen the story flow", dataCitations: "Add data and citations", createSpeakerNotes: "Create speaker notes", improveLayout: "Improve slide layout", rewriteExecutives: "Rewrite for executives", supportingVisual: "Add a supporting visual", consistentDeck: "Make the deck visually consistent", sourceCitations: "Add data and source citations", slideSpeakerNotes: "Create speaker notes for this slide", makeShorter: "Make it shorter", makeSmaller: "Make this smaller", replaceImage: "Generate a new image and replace this one", addChart: "Add a chart", addTable: "Add a table", conciseOutline: "Make the outline concise" },
  },

  imageEditor: {
    title: "Update Image",
    tabs: { generate: "AI Generate", upload: "Upload", edit: "Edit" },
    prompt: {
      current: "Current Prompt",
      description: "Image Description",
      placeholder: "Describe the image you want to generate…",
      required: "Please enter a prompt",
    },
    generation: {
      generating: "Generating…",
      action: "Generate Image",
      failedTitle: "Image generation failed",
      failedDescription: "Failed to generate image. Please try again.",
      previous: "Previous Generated Images",
    },
    upload: {
      uploading: "Uploading your image…",
      action: "Click to upload an image",
      maxSize: "Maximum file size: 5 MB",
      tooLarge: "File size should be less than 5 MB",
      invalidType: "Please upload an image file",
      failedTitle: "Upload failed",
      failedDescription: "Failed to upload image. Please try again.",
      preview: "Uploaded Image Preview",
      processing: "Processing…",
      clickToUse: "Click to use this image",
      list: "Uploaded Images:",
      use: "Use",
      alt: "Uploaded preview",
    },
    library: {
      loadFailedTitle: "Could not load images",
      generatedLoadFailed: "Failed to get previous generated images. Please try again.",
      uploadedLoadFailed: "Failed to get uploaded images. Please try again.",
      deletedTitle: "Image deleted",
      deletedDescription: "The image was removed from your uploads.",
      deleteFailedTitle: "Could not delete image",
      deleteFailedDescription: "Failed to delete image. Please try again.",
    },
    edit: {
      current: "Current Image",
      changeFocus: "Click to Change Focus Point",
      setFocus: "Click anywhere to set focus point",
      done: "Done",
      previewAlt: "Preview",
      replace: "Replace image",
      fill: "Fill",
      contain: "Contain",
      stretch: "Stretch",
      focusPoint: "Focus point",
    },
  },

  presentation: {
    status: { loading: "Loading presentation", creating: "Creating your presentation", creatingHint: "This can take a few minutes depending on slide count.", stoppedWithDraft: "Generation stopped. Your draft so far was kept.", stopped: "Generation stopped.", noContent: "No new content for 45 seconds.", stopping: "Stopping…", ready: "Presentation ready", stalled: "Presentation stream stalled — waiting for the server.", reconnecting: "Reconnecting to presentation stream", generatingSlide: (p) => `Creating slide ${p.current}…`, generatingSlideOf: (p) => `Creating slide ${p.current} of ${p.total}…`, readingDocuments: "Reading source documents", searchingWeb: "Searching the web", searchingWebImages: "Searching the web for slide images", importingSlideImages: "Importing slide images", designingComplete: "Designing the complete presentation", streamingFailed: "Presentation streaming failed", connectFailed: "Failed to connect to the server. Please try again.", completedLoadFailed: "Failed to load the completed presentation." },
    error: { title: "Something went wrong", loadDescription: "We couldn't load your presentation. Please try again.", refresh: "Refresh page", goToUpload: "Go to upload" },
    header: { fallbackTitle: "Presentation", titlePlaceholder: "Presentation title", titleAria: "Presentation title", saveTitle: "Save · Enter", saveAria: "Save title", cancelTitle: "Cancel · Esc", cancelAria: "Cancel editing title", dashboardAria: "Go to dashboard", rename: "Rename presentation", selectionOn: "Element selection is on", selectionHint: "Click a slide element to add it to AI chat", selectToEdit: "Select to edit", regenerate: "Regenerate presentation", undo: "Undo", redo: "Redo", present: "Present", shortcuts: "Keyboard shortcuts (?)", shortcutsAria: "Keyboard shortcuts", export: "Export", exportAs: "Export as", regenerateDialogTitle: "Regenerate presentation?", regenerateDialogDescription: "This will replace the current slides with a newly generated version and clear undo history. Your current edits may be lost." },
    export: { exportingPptx: "Exporting PPTX", exportingPdf: "Exporting PDF", exportingDescription: "Your presentation is being exported. This may take a moment.", complete: "Export complete", pptxDownloaded: "Your PPTX file has been downloaded.", pdfDownloaded: "Your PDF file has been downloaded.", failed: "Export failed", failedDescription: "We are having trouble exporting your presentation. Please try again." },
    mode: { aria: "Presentation", previous: "Previous slide", next: "Next slide", of: "of", layoutPreview: "Layout preview", speakerNote: "Speaker note", exit: "Exit presentation" },
    page: { navigateWith: "Navigate with", arrowKeys: "arrow keys", orThumbnails: "or the left thumbnails", dismissHint: "Dismiss navigation hint", closeAssistant: "Close AI Assistant", assistant: "AI Assistant", closeTools: "Close tools panel", missingId: "No presentation id found", tryAgain: "Please try again", goHome: "Go to home" },
    slidesAria: "Presentation slides",
    slideLimit: "Slide limit reached",
    slideLimitDescription: (p) => `You can have up to ${p.max} slides.`,
    data: { unsupportedTitle: "Unsupported presentation", unsupportedDescription: "This deck was created in an older GSlide version. Use a compatible version to open it.", loadFailedTitle: "Failed to load presentation", loadFailedDescription: "The presentation could not be loaded. Please try again.", imageWarningTitle: "Some images could not be generated", imageSearchWarningTitle: "Some slide images use placeholders", draftNotSavedTitle: "Draft not saved", draftNotSavedDescription: "Refresh may lose the stopped slides." },
    newSlide: { empty: "Empty slide", layoutFallback: "Slide layout", addFailed: "Could not add slide", addFailedDescription: "Something went wrong while adding the new slide.", refreshWarning: "Could not refresh template layouts; using presentation layouts instead.", noLayouts: "This template does not contain any usable layouts.", loadFailed: "Could not load layouts for this template.", closeAria: "Close layout picker", loading: "Loading layouts", layoutCount: (p) => `${p.count} layouts`, addLayoutAria: (p) => `Add ${p.name} layout`, choose: "Choose slide layout", noAvailable: "No layouts available." },
    slideActions: { blank: "Blank", useTemplate: "Use Template", speakerNotes: "Speaker notes", noSpeakerNotes: "No speaker notes for this slide.", menuAria: "Slide actions", duplicate: "Duplicate Slide", moveUp: "Move Up", moveDown: "Move Down", delete: "Delete Slide", missingContextTitle: "Could not add blank slide", openTemplatesFailedTitle: "Could not open templates", missingContextDescription: "This slide does not have a template context." },
    tools: { aria: "Editor tools", ai: "AI", blocks: "Blocks", texts: "Texts", charts: "Charts", tables: "Tables", images: "Images", elements: "Elements", add: "Add", chartType: "Chart Type", infographics: "Infographics", tableType: "Table Type", content: "Content", searchBlocks: "Search blocks", createBlock: "Create block", loadingBlocks: "Loading template components…", noBlocks: "No template components found.", loadBlocksFailed: "Could not load template components.", layoutCount: (p) => `${p.count} layouts`, blocksNeedTemplate: "Blocks require a presentation template", selectSlideTitle: "Select a slide", selectSlideDescription: "Choose a slide before adding content.", insertUnavailableTitle: "Insert unavailable", insertUnavailableDescription: "Content can be added only to slides imported through the slide editor.", componentUnavailableTitle: "Component unavailable", componentUnavailableDescription: "This template component cannot be inserted yet." },
    shortcuts: {
      title: "Keyboard shortcuts", description: "Work faster while the slide canvas is active. Shortcuts pause while you are typing in a text field.", platformAria: "Shortcut platform", windowsLinux: "Windows / Linux", showingFor: (p) => `Showing shortcuts for ${p.platform}.`,
      sections: { selection: { title: "Selection", description: "Select and organize objects on the active slide." }, editing: { title: "Editing", description: "Common editing commands for slide objects." }, arrange: { title: "Arrange", description: "Change the selected object’s layer position." }, navigation: { title: "Slide navigation", description: "Move between slides without leaving the canvas." }, help: { title: "Help", description: "Quickly return to this reference." } },
      items: { multiSelect: { label: "Add to selection", description: "Hold Shift while clicking to add or remove an object." }, group: { label: "Group objects", description: "Combine two or more selected objects into one group." }, delete: { label: "Delete selection", description: "Remove the selected object or objects from the slide." }, undo: { label: "Undo", description: "Undo the last change made on the active slide." }, redo: { label: "Redo", description: "Restore the most recently undone slide change." }, copy: { label: "Copy selection", description: "Copy the selected object or objects." }, paste: { label: "Paste", description: "Paste copied objects with a small position offset." }, bringForward: { label: "Bring forward", description: "Move the selected object forward by one layer." }, bringToFront: { label: "Bring to front", description: "Move the selected object above every other object." }, sendBackward: { label: "Send backward", description: "Move the selected object backward by one layer." }, sendToBack: { label: "Send to back", description: "Move the selected object behind every other object." }, previousSlide: { label: "Previous slide", description: "Open the slide before the active slide." }, nextSlide: { label: "Next slide", description: "Open the slide after the active slide." }, help: { label: "Keyboard shortcuts", description: "Open this keyboard-shortcuts guide." } },
    },
  },

  metadata: {
    title: "GSlide - AI presentation generator",
    description:
      "Open-source AI presentation generator with custom layouts, multi-model support (OpenAI, Gemini, OpenAI-compatible), and PDF/PPTX export. A free Gamma alternative.",
    // Comma-separated so the catalog stays string-typed; `layout.tsx` splits it.
    keywords:
      "AI presentation generator, data storytelling, data visualization tool, AI data presentation, presentation generator, data to presentation, interactive presentations, professional slides",
    siteName: "GSlide",
    logoAlt: "GSlide Logo",
  },

  loading: {
    splash: "Preparing your workspace…",
    configLoading: "Loading GSlide…",
  },

  errors: {
    notFound: {
      title: "Page not found | GSlide",
      heading: "Oops! Page Not Found",
      body:
        "It seems you've found a page that doesn't exist. But don't worry, every great presentation starts with a blank slide!",
      goHome: "Go to Homepage",
      backToStart: "Back to start",
      alt: "Page not found",
    },
    global: {
      title: "Something went wrong",
      body: "An unexpected error occurred. Please reload the page.",
    },
    backend: {
      outlineParseFailed: "Failed to parse the generated outline. Please try again.", outlineSlideCount: "Failed to generate presentation outlines with the requested number of slides. Please try again.", outlineGenerationFailed: "Failed to generate presentation outlines. Please try again.", slidesGenerationFailed: "Failed to generate presentation slides. Please try again.", chatStreamFailed: "Chat stream failed. Please try again.",
      templateNotFound: "Template not found. Please use a valid template.", templateLayoutNotObject: "Template layout JSON must be an object.", bundledTemplateUnavailable: (p) => `Bundled template '${p.template_name}' is not available. Restart the service to import bundled templates.`, templateLayoutInvalidJson: "Invalid template layout JSON.", templateLayoutMinOne: "Template layout JSON must contain at least one layout.", templateIdRequired: "Template id is required.", templateLayoutNotFound: "Template layout not found.",
      presentationNotFound: "Presentation not found.", slidesMustBePositive: "Number of slides must be greater than 0.", slidesTooMany: (p) => `Number of slides cannot be greater than ${p.max}.`, slidesTocMin: "Number of slides cannot be less than 3 if table of contents is included.", promptRequired: "A prompt or document is required.", outlinesRequired: "Outlines are required.", outlinesTooMany: (p) => `Number of outlines cannot be greater than ${p.max}.`, layoutMinOne: "Layout must contain at least one slide layout.", notPreparedForStream: "Presentation not prepared for stream.", outlinesEmpty: "Outlines cannot be empty.", presentationDataInvalid: "Presentation has invalid generated data.", presentationLayoutEmpty: "Presentation layout has no slides.", presentationStructureMismatch: "Presentation structure has more slides than outlines.", presentationLayoutInvalid: "Presentation structure contains an invalid slide layout.", uuidRequired: "Slide and presentation IDs must be valid UUIDs.", slideNotFound: "Slide not found.", slideMismatch: "Slide does not belong to the supplied presentation.", contentRequired: "Either content, slides markdown, or files is required to generate a presentation.", generationFailed: "Presentation generation failed.", generationTaskNotFound: "No presentation generation task found.",
      imageInvalidType: (p) => `Invalid image file type. Accepted types: ${p.accepted}.`, imageEmptyFile: "Uploaded image file is empty.", imageUnsupportedFormat: "Uploaded image format is not supported.", imageInvalidImage: "Uploaded file is not a valid image.", imageRetrieveGeneratedFailed: "Failed to retrieve generated images.", imageUploadFailed: "Failed to upload image.", imageListUploadedFailed: "Failed to retrieve uploaded images.", imageNotFound: "Image not found.", imageDeleteFailed: "Failed to delete image.", imageGenerationFailed: "Image generation failed. Please try again or use a different prompt.",
      imageSearchDisabled: "Web image search is disabled on this server.",
      imageSearchNotConfigured: "Web image search is not configured on this server, so some slides use placeholder images. Slide text is unaffected.",
      imageSearchEmptyQuery: "No usable image search phrase was produced, so a placeholder image is shown. Slide text is unaffected.",
      imageSearchNoResults: "No suitable web image was found for some slides, so placeholder images are shown there. Slide text is unaffected.",
      imageSearchSearchTimeout: "Web image search timed out, so placeholder images are shown. Slide text is unaffected.",
      imageSearchImportTimeout: "Downloading a web image timed out, so a placeholder image is shown. Slide text is unaffected.",
      imageSearchDownloadFailed: "A web image could not be downloaded, so a placeholder image is shown. Slide text is unaffected.",
      imageSearchCandidateRejected: "Web image results were rejected for safety or format reasons, so placeholder images are shown. Slide text is unaffected.",
      imageSearchImporterUnavailable: "Web image import is unavailable right now, so placeholder images are shown. Slide text is unaffected.",
      imageSearchNoUsableCandidate: "No downloadable image could be used from the web results, so placeholder images are shown. Slide text is unaffected.",
      imageSearchPlaceholderFallback: "Web images could not be placed on some slides, so placeholder images are shown. Slide text is unaffected.",
      documentsRequired: "Documents are required.", fileTooLarge: (p) => `File '${p.filename}' exceeded max upload size of ${p.max_size} MB.`, fileTypeNotAccepted: (p) => `File '${p.filename}' was not accepted. Accepted types: ${p.accepted_types}.`, fileRequired: "File must be provided.",
      templateResourceNotFound: "Template not found.", templateBuiltinReadonly: "Built-in templates are read-only.", templateImagesRequired: "At least one slide image is required.", templateExactlyOneImage: "Exactly one slide image is required for each slide layout.", templatePptxNotFound: "PPTX file not found.", templateLayoutGenerationInvalid: "Slide layout generation produced invalid output.", templatePptxJsonInvalid: "PPTX-to-JSON export produced invalid slide layout JSON.", templateInvalidSlideIndex: "Invalid slide index.", templatePatchedLayoutsInvalid: "Patched template layouts are invalid.", templateLayoutsInvalid: "Template layouts are invalid.", templateLayoutsUnavailable: "Template layouts are unavailable.", templateRawLayoutsUnavailable: "Template raw layouts are unavailable.", templateRawLayoutsInvalid: "Template raw layouts are invalid.", templateSlideImageUnavailable: "Slide image URL is unavailable for the requested slide index.", templateLayoutCreationInvalid: "Slide layout creation produced invalid output.", templateIdMismatch: "Template ID in path does not match request body ID.", templateNameRequired: "Template name is required.", templateMergedComponentsInvalid: "Template merged components are invalid.",
      themeInvalidLogoId: "Invalid logo id.", themeLogoNotFound: "Logo not found.", themeNotFound: "Theme not found.", providerInvalidApiKey: "Invalid API key. Please verify your API key and try again.", providerSafetyBlocked: "The request was blocked by the provider's safety system. Please revise it and try again.", providerImageSafetyPlaceholder: "An image request was blocked by the safety system. A placeholder image was used for that slide.", providerGeneric: "The AI provider returned an error. Please try again.", providerQuota: (p) => `${p.provider} API quota is unavailable. Check billing and project limits.`, providerKeyAccess: (p) => `${p.provider} rejected the request because the configured API key does not have access.`, providerRateLimited: "The AI provider is temporarily rate limited. Please wait and try again.", providerModelUnavailable: (p) => `The selected ${p.provider} model is not available. Choose another model or check model access.`,
    },
  },

  config: {
    providerNotConfigured: {
      title: "AI provider not configured",
      description:
        "Open Settings to configure your text, image, and web search providers.",
    },
    instanceNotConfigured: {
      title: "Instance not configured",
      description:
        "Ask your operator to set AI provider keys in the deployment environment, or sign in and add your own keys in Settings.",
    },
  },

  settings: {
    metadata: {
      title: "Settings | GSlide",
      description: "Settings page",
    },
    header: {
      title: "Settings",
    },
    actions: {
      save: "Save",
      saving: "Saving…",
      cannotSave: "Cannot save settings",
      savedTitle: "Settings saved",
      savedDescription: "Your configuration was saved successfully.",
      saveErrorTitle: "Could not save settings",
      saveErrorFallback: "Something went wrong while saving.",
    },
    summary: {
      webSearchDisabled: "Web search disabled",
      webNoProvider: "No provider",
    },
    sections: {
      aria: "Settings sections",
      text: "Text",
      image: "Image",
      search: "Search",
      analytics: "Analytics",
      privacyHint: "Privacy controls",
    },
    common: {
      noModelsFound:
        "No models found. Please make sure your provider credentials are valid and the selected provider is reachable.",
    },
    text: {
      title: "Text Generation Settings",
      subtitle: "Choosing where text content comes from",
      selectProvider: "Select Text Provider",
      providerPlaceholder: "Select text provider",
      searchProvider: "Search provider…",
      noProvider: "No provider found.",
      apiKeyLabel: (p) => `${p.provider} API Key`,
      customApiKeyLabel: "Custom LLM API Key",
      apiKeyPlaceholder: (p) => `Enter your ${p.label}`,
      customUrl: "OpenAI-compatible URL",
      selectModel: (p) => `Select ${p.provider} Model`,
      modelPlaceholder: "Select a model",
      searchModels: "Search models…",
      noModel: "No model found.",
      fetchingModels: "Fetching models…",
      checkingModels: "Checking for models…",
      checkModels: "Check models",
      loadModelsError: "Could not load models",
      loadModelsFallback:
        "Something went wrong while contacting the provider. Check your network and try again.",
      fetchModelsServerError: (p) =>
        `The server could not list ${p.provider} models. Check your API key or endpoint and try again.`,
    },
    image: {
      title: "Image Generation Settings",
      subtitle: "Choosing where images come from",
      selectProvider: "Select Image Provider",
      providerPlaceholder: "Select image provider",
      searchProvider: "Search provider…",
      noProvider: "No provider found.",
      apiKeyLabel: "API Key",
      qualityLabel: "GPT Image 1.5 Quality",
      selectQuality: "Select a quality",
      enableDisableAria: "Enable/Disable Image Generation",
      imageModelId: "Image model id",
      imageModelPlaceholder: "e.g. gpt-image-1.5",
    },
    webSearch: {
      title: "Web Search Settings",
      subtitle:
        "Set how many web results to include when a presentation turns web search on.",
      autoHint:
        "OpenAI and Google use native search. Custom models use the SearXNG sidecar configured at deploy time.",
      maxResults: "Maximum results",
      imageDisclosure:
        "When web search is on for a presentation, slide images are also searched on the web. Searched images come from third-party sources and may have usage restrictions.",
    },
  },

  themes: {
    page: {
      title: "Themes",
    },
    actions: {
      newTheme: "New Theme",
      newThemeShort: "New",
      createNewAria: "Create new theme",
    },
    tabs: {
      custom: "Custom",
      builtin: "Built-in",
    },
    newCustomTheme: {
      name: "New Custom Theme",
      description: "Start with a blank canvas",
    },
    steps: {
      brand: "Brand",
      palette: "Palette",
      fonts: "Fonts",
      logo: "Logo",
      stepLabel: (p) => `Step-${p.step}`,
    },
    colorStep: {
      brandColors: "Brand Colors",
      palette: "Palette",
      textColors: "Text Colors",
      graphColors: "Graph/Chart Colors",
      primaryColor: "Primary Color",
      backgroundColor: "Background Color",
      backgroundText: "Background Text",
      primaryText: "Primary Text",
      cardColor: "Card Color",
    },
    fontStep: {
      typography: "Typography",
      uploadCustomFont: "Upload Custom Font",
      uploadingFont: "Uploading font…",
      pleaseWait: "Please wait",
      uploadFontFile: "Upload Font File",
      fontFormats: ".ttf, .otf, .woff, .woff2",
      yourFonts: "Your Uploaded Fonts",
      presets: "Pre-Sets",
    },
    logoStep: {
      logo: "Logo",
      companyName: "Company Name",
      companyNamePlaceholder: "Enter company name",
      brandLogo: "Brand Logo",
      uploadingLogo: "Uploading logo…",
      removeLogo: "Remove Logo",
      clickToUpload: "Click to upload",
      orDragAndDrop: " or drag and drop",
    },
    editor: {
      back: "Back",
      generatePalette: "Generate theme palette",
      continueToFonts: "Continue to Fonts",
      continueToDesign: "Continue to Design",
      saveAsCustom: "Save as Custom Theme",
    },
    card: {
      deleteTitle: "Delete Theme?",
      deleteBody: (p) =>
        `You're about to delete "${p.name}". This action cannot be undone.`,
      copyId: "Copy ID",
      copied: "Copied!",
      fontTooltip: "Font",
      companyTooltip: "COMPANY",
      logoTooltip: "LOGO",
      previewText: "Choose your preferences.",
    },
    empty: {
      buildTheme: "Build Theme",
      fromColors: "From colors",
      fonts: "fonts",
    },
    toast: {
      loadThemesError: "Could not load themes",
      loadThemesFallback:
        "Your saved themes could not be loaded. Built-in themes are still available.",
      loadFontsError: "Could not load fonts",
      loadFontsFallback: "Your uploaded fonts could not be loaded right now.",
      logoUploadError: "Could not upload logo",
      logoUploadFallback:
        "Something went wrong while uploading your logo. Please try again.",
      themeUpdated: "Theme updated",
      themeUpdatedDescription: "Your theme changes were saved.",
      themeUpdateError: "Could not update theme",
      themeUpdateFallback: "Something went wrong while saving your theme changes.",
      themeSaved: "Theme saved",
      themeSavedDescription: "Your new theme was created and is ready to use.",
      themeSaveError: "Could not save theme",
      themeSaveFallback: "Something went wrong while creating your theme.",
      themeDeleted: "Theme deleted",
      themeDeletedDescription: "The theme was removed from your library.",
      themeDeleteError: "Could not delete theme",
      themeDeleteFallback: "Something went wrong while deleting the theme.",
      fontUploaded: "Font uploaded",
      fontUploadedDescription: (p) =>
        `Font "${p.name}" is now available for your themes.`,
      fontUploadError: "Could not upload font",
      fontUploadFallback: "Something went wrong while uploading the font file.",
    },
  },

  templates: {
    page: {
      title: "Templates",
    },
    error: {
      loadFailed: (p) => `Templates could not be loaded: ${p.error}`,
      loadTitle: "Could not load templates",
      serviceUnavailable: "The template service could not be reached. Please try again.",
    },
    loading: {
      default: "Loading templates...",
    },
    empty: {
      noBuiltin: "No built-in templates available.",
      noTemplates: "No templates available.",
    },
    card: {
      openAria: (p) => `Open ${p.name} template`,
      thumbnailAria: (p) => `${p.name} thumbnail`,
    },
  },

  slideEditor: {
    common: { color: "Color", opacity: "Opacity", width: "Width", radius: "Radius", position: "Position", blur: "Blur", amount: "Amount", fill: "Fill", stroke: "Stroke", shadow: "Shadow", settings: "Settings", on: "On", off: "Off", close: "Close", more: "More", duplicate: "Duplicate", delete: "Delete", ungroup: "Ungroup", group: "Group", shortcutAria: "Keyboard shortcut", or: "or" },
    text: { fontSize: "Font size", increaseFontSize: "Increase font size", decreaseFontSize: "Decrease font size", textColor: "Text color", bold: "Bold", italic: "Italic", underline: "Underline", latexToText: "Convert LaTeX to text", textToLatex: "Convert selected text to LaTeX", listAlignmentUnavailable: "Alignment is unavailable for list text", horizontalAlignment: "Horizontal alignment", listMarker: "List marker", allFonts: "All Fonts", templateFonts: "Template Fonts", googleFonts: "Google Fonts", fontFamily: "Font family", searchFonts: "Search fonts", clearSearch: "Clear font search", swapFontSource: "Swap font source", noFonts: "No fonts", letterSpacing: "Letter spacing", lineHeight: "Line height", bulletList: "Bullet list", numberedList: "Numbered list", noList: "No list", editLatex: "Edit LaTeX expression", latexExpression: "LaTeX expression" },
    image: { fill: "Fill", contain: "Contain", stretch: "Stretch", imageType: (p) => `Image type: ${p.type}`, upload: "Upload image", replace: "Replace image", crop: "Crop image", flipHorizontal: "Flip horizontally", flipVertical: "Flip vertically", borderRadius: "Image border radius", opacity: "Image opacity", resetCrop: "Reset crop", applyCrop: "Apply crop", closeCrop: "Close crop controls", cropZoom: (p) => `Crop image. Zoom ${p.percent} percent.`, uploadFailed: "Upload failed", invalidFile: "Please choose a valid image file.", tooLarge: "Image files must be smaller than 5 MB.", uploaded: "Image uploaded", replaced: "The selected image was replaced.", uploadFallback: "Could not upload image.", updated: "Image updated", updateFallback: "Failed to upload image. Please try again.", resizeHandle: (p) => `${p.direction} resize handle`, aiProvider: "AI image provider", loadGeneratedFailed: "Could not load generated images.", loadUploadedFailed: "Could not load uploaded images.", someVariantsFailed: "Some variants failed", variantsGenerated: (p) => `Generated ${p.generated} of ${p.total} requested images.`, generationFailed: "Image generation failed", generationFailedDescription: "Image generation failed.", selectFromLibrary: "Select it from your image library.", deleted: "Image deleted", removedFromLibrary: "The upload was removed from your library.", deleteFailed: "Could not delete image", deleteFallback: "Delete failed.", changeTitle: "Change Image", changeDescription: "Choose an image from the library or upload your own.", uploadAction: "Upload", discover: "Discover Image", useYours: "Use Your Image", generationDisabled: "Image generation is disabled in Settings.", discoverEmpty: "Generate images to see them here. Start by describing what you want to create above.", uploadEmpty: "Upload an image to add it to your library.", dropUpload: "Drop image to upload", maxSize: "Maximum file size: 5 MB", closePicker: "Close image picker", generateWith: (p) => `Generate with ${p.provider}`, describe: "Describe your image", fewerVariations: "Fewer variations", variations: (p) => `${p.count} variation(s)`, moreVariations: "More variations", generateVariations: (p) => `Generate ${p.count} image variations with ${p.provider}`, useImage: "Use this image", deleteUploaded: "Delete uploaded image" },
    icon: { color: "Icon color", change: "Change icon", thin: "Thin", light: "Light", regular: "Regular", bold: "Bold", fill: "Fill", duotone: "Duotone", loadFailed: "Could not load icons", loadFallback: "Failed to fetch icons. Please try again.", required: "Icon required", selectFirst: "Select an icon before replacing.", weightHelp: "Choose the visual weight used for icon search and replacement.", applyAll: "Apply icon weight to entire presentation", searchSimilar: "Search similar icons", search: "Search icons", select: (p) => `Select icon ${p.number}`, allHint: "The selected weight will be applied to every icon.", selectedHint: "Only the selected icon will be replaced.", close: "Close icon editor", changeTitle: "Change Icon", changeDescription: "Find a similar icon and customize its visual weight.", selectedIcon: "Selected icon", iconWeight: "Icon weight", applyPresentation: "Apply to presentation", useEveryIcon: "Use this weight for every icon.", similarIcons: "Similar icons", results: (p) => `${p.count} results`, noIcons: "No icons found", tryDifferent: "Try a different search term.", replace: "Replace icon" },
    table: { cellBackground: "Cell background color", alignment: "Table alignment", align: (p) => `Align ${p.alignment}`, deleteRow: "Delete Row", deleteColumn: "Delete Column", addRow: "Add Row", addColumn: "Add Column", moveColumnRight: "Move Column Right", moveColumnLeft: "Move Column Left", cellActions: "Table cell actions" },
    chart: { bar: "Bar Chart", horizontalBar: "Horizontal Bar", stackedBar: "Stacked Bar", horizontalStackedBar: "Horizontal Stack Bar", line: "Line Chart", area: "Area Chart", pie: "Pie Chart", donut: "Donut Chart", scatter: "Scatter Chart", radar: "Radar Chart", polarArea: "Polar Area", type: "Chart type", editCharts: "Edit Charts", data: "Data", customize: "Customize", editData: "Edit data", colors: "Chart colors", closeColors: "Close color palette", theme: "Theme", selectThemeColor: (p) => `Select theme color ${p.number}`, addColor: "Add chart color", systemColors: "System colors", customColor: "Custom chart color", setColor: (p) => `Set chart color #${p.color}`, closeEditor: "Close chart editor", dataLabels: "Data labels", labelPosition: "Data label position", base: "Base", middle: "Middle", top: "Top", outside: "Outside", text: "Text", title: "Title", titlePlaceholder: "Chart title", titleColor: "Title color", xAxis: "X Axis", yAxis: "Y Axis", showAxis: "Show axis", showGrid: "Show grid", xAxisTitle: "X-axis title", yAxisTitle: "Y-axis title", categoryLabels: "Category labels", spokes: "Spokes", valueLabels: "Value labels", rings: "Rings", showLegend: "Show legend", legendColor: "Legend color", axisColor: "Axis color", gridColor: "Grid color", changeColor: (p) => `Change chart color ${p.number}`, colorNumber: (p) => `Chart color ${p.number}`, closeDataEditor: "Close data editor", item: (p) => `Item ${p.number}`, series: (p) => `Series ${p.number}`, deleteSeries: "Delete selected series", moreColumnActions: "More column actions", deleteRowLabel: (p) => `Delete ${p.category || `row ${p.number}`}` },
    layout: { gap: "Gap", increaseGap: "Increase gap", decreaseGap: "Decrease gap", items: "Items", addItem: "Add Item", lastItem: "Last Item", infographicType: "Infographic type", progressBar: "Progress Bar", gauge: "Gauge", value: "Value", range: "Range", min: "Min", max: "Max", colors: "Colors", base: "Base", highlight: "Highlight", cornerRadius: "Corner Radius", layoutSettings: "Layout Settings", closedPath: "Closed path", straight: "Straight", tension: "Tension", smoothness: "Smoothness", shapeFill: "Shape fill", fillColor: "Fill color", fillOpacity: "Fill opacity", shapeBorder: "Shape border", borderColor: "Border color", borderWidth: "Border width", borderOpacity: "Border opacity", borderRadius: "Border radius", vectorPath: "Vector path", shapeShadow: "Shape shadow", shapeOpacity: "Shape opacity" },
    selection: { bringToFront: "Bring to Front", bringForward: "Bring Forward", sendBackward: "Send Backward", sendToBack: "Send Back", deleteComponent: "Delete Component", selected: (p) => `${p.count} selected` },
    surface: { invalidFile: "Invalid file", uploadImageOnly: "Please upload an image file.", tooLarge: "File too large", imageTooLarge: "Image files must be smaller than 5 MB.", updated: "Image updated", replaced: "The selected image was replaced.", uploadFailed: "Upload failed", uploadFallback: "Could not upload image.", loadingLayout: "Loading slide layout…" },
  },

  templateStudio: {
    topbar: { dashboard: "Dashboard", progressAria: "Template Studio progress", title: "Template Studio", description: "Upload your PPTX file to extract slides and convert them into a reusable template for AI presentations." },
    steps: { upload: "Upload", analyze: "Analyze", preview: "Preview", review: "Review" },
    upload: { title: "Turn a PPTX into a reusable template", description: "Upload a presentation so GSlide can analyze its layouts, fonts, and design components.", uploadPptx: "Upload PPTX File", dropTitle: "Drag & Drop your files here", browse: "or click to browse", processing: "Processing", processingFile: "Processing…", ready: "Ready", getStarted: "Get Started", removeFileAria: "Remove file", realtime: "Test in Real Time", maxSize: "Max 100 MB", generationTime: "5 min Generation", modelHint: "GSlide sends each slide as a screenshot and HTML reference. Use a vision-enabled model for accurate layouts. Text-only models may produce poor results or fail.", invalidFileTitle: "Invalid file", invalidFileDescription: "Please select a valid PPTX file.", tooLargeTitle: "File too large", tooLargeDescription: "File size must be less than 100 MB." },
    fonts: { unknown: "Unknown font", chooseFallback: "Choose fallback", search: "Search fonts", loading: "Loading fonts…", empty: "No fonts found", allAvailable: "All fonts are available", preparingPreview: "Preparing the slide preview automatically.", resolved: "Missing fonts resolved", resolvedDescription: "All required font files are attached. Continue to preview.", needAttention: "Fonts need attention", attentionCount: (p) => `${p.count} font(s) need attention`, unavailableCount: (p) => `${p.count} font(s) are unavailable. Upload exact font files or use the selected fallback fonts before continuing.`, uploadOrFallback: "Upload exact font files or keep the selected fallback fonts before continuing.", missing: "Missing fonts", continueWithFallback: "Continuing without uploaded font files. Selected Google replacements will be applied.", uploadTitle: "Fonts Upload", noDetected: "No fonts detected", continue: "Continue", resolveTitle: "Resolve Missing Font", missingDescription: (p) => `${p.name} is missing.`, uploadOriginal: "Upload original font file", or: "or", fallback: "Fallback font", fallbackFor: (p) => `Fallback font for ${p.name}`, exactHint: "Exact font files maintain typography and spacing. Fallback fonts may slightly change the layout and text wrapping.", preparing: "Preparing…", creating: "Creating…", uploaded: "Font file uploaded", uploadFile: "Upload .ttf / .otf", checkFailedTitle: "Font check failed", alreadyAddedTitle: "Font already added", alreadyAddedDescription: (p) => `Font “${p.name}” is already in your upload list.`, invalidTitle: "Invalid font file", invalidDescription: "Please upload .ttf, .otf, .woff, .woff2, or .eot files.", tooLargeTitle: "File too large", tooLargeDescription: "Font file size must be less than 10 MB.", addedTitle: "Font added", addedDescription: (p) => `Font “${p.name}” was added successfully.`, removedTitle: "Font removed", removedDescription: "The font was removed from your upload list." },
    preview: { generating: "Generating slide…", unavailable: "Slide unavailable", renderFailed: "Failed to render slide component. Check console for details.", reconstruct: "Re-Construct", close: "Close", scrollLeft: "Scroll thumbnails left", scrollRight: "Scroll thumbnails right", deleteSlide: "Delete slide", noDataTitle: "No preview data", noDataDescription: "Prepare the document before continuing.", unavailableTitle: "Template unavailable", initializeFirst: "Initialize the template before trying again.", createFirst: "Create the slide preview before continuing.", generateFirst: "Generate the template before saving.", showingAiPreview: "Showing AI-generated preview", clear: "Clear", imageTooLarge: "Image Too Large", conversionFailed: "Conversion Failed", imageTooLargeDescription: "This slide's image exceeds the 5 MB limit. Try using a lower-resolution PPTX file or compressing its images.", retry: "Retry", updating: "Updating slides…" },
    modal: { saveTitle: "Save Template", createTitle: "Create Template", saveSubtitle: "Give your template a name.", createSubtitle: "Name this template before generation starts.", name: "Template name", namePlaceholder: "e.g. Modern Tech Pitch Deck", description: "Description", descriptionPlaceholder: "Briefly describe when or how this template should be used.", untitled: "Untitled Template", save: "Save", create: "Create", creating: "Creating Template…", saveAs: "Save as Template", generating: "Generating Template" },
    toast: { documentPreparedTitle: "Document prepared", documentPreparedDescription: "Template generation is starting now.", documentFailedTitle: "Document preparation failed", generationStartedTitle: "Template generation started", generationStartedDescription: "You can track the template status from the Templates page.", generationFailedTitle: "Failed to create template", unexpected: "An unexpected error occurred", generatedTitle: "Template generated", generatedDescription: "The template was generated and saved successfully.", partialTitle: "Some slides could not be generated", partialDescription: (p) => `${p.processed} of ${p.total} slides were generated.`, blocksFailedDescription: (p) => `Slides were saved, but template blocks were not generated. ${p.error}`, savedTitle: "Template saved", savedDescription: "The template was saved successfully.", saveFailedTitle: "Failed to save template", slideRegenerated: "Slide regenerated", slideRegeneratedDescription: (p) => `Slide ${p.number} was regenerated successfully.`, slideFailedTitle: (p) => `Slide ${p.number} failed`, copied: "Copied", layoutIdCopied: "Template layout ID copied.", templateIdCopied: "Template ID copied.", copyFailed: "Copy failed", changesSaved: "Changes saved", jsonUpdated: "Template JSON was updated.", deleted: "Template deleted", deletedDescription: "The template was deleted successfully.", deleteFailed: "Could not delete template" },
    editor: { templateFallback: "Template", untitled: "Untitled Template", dashboard: "Dashboard", templateName: "Template name", editName: "Edit template name", defaultTemplate: "Default template", undo: "Undo", redo: "Redo", deleteTemplate: "Delete Template", deleteQuestion: "Delete template?", deleteDescriptionPrefix: "This will permanently delete", deleteDescriptionSuffix: ". This action cannot be undone.", loadingTemplate: "Loading template…", loadError: "Error loading template", backToTemplates: "Back to Templates", notFound: "Template not found", saveChanges: "Save changes", saveTemplate: "Save template", saving: "Saving", save: "Save", noLayouts: "No layouts available for this template.", deckLayouts: "Deck Layouts", noLayoutsFound: "No layouts found.", searchSlides: "Search Slides", copyId: "Copy ID", copyLayoutId: (p) => `Copy layout ${p.number} ID`, selectLayout: (p) => `Select layout ${p.number}`, slideId: "Slide ID", slideDescription: "Slide Description", addSlideId: "Add Slide ID", addSourceText: "Add Source Text", reconstruct: "Re-Construct", addBlank: "Add blank slide", blank: "Blank", slideActions: "Slide actions", duplicateSlide: "Duplicate Slide", moveRight: "Move Right", moveLeft: "Move Left", deleteSlide: "Delete Slide", previousSlide: "Previous slide", nextSlide: "Next slide", thumbnailsAria: "Slide thumbnails. Use the left and right arrow keys to change slides.", deleting: "Deleting", noEditableTitle: "No editable content", noEditableDescription: "Mark a schema field as non-decorative before testing content density.", blankUnavailableTitle: "Slide unavailable", blankUnavailableDescription: "The blank slide is no longer available. Add a new one and try again.", slideCreated: "Slide created", slideCreatedDescription: (p) => `Slide ${p.number} was generated. Save to keep it.`, createSlideFailed: "Failed to create slide", createSlideFallback: "Something went wrong while creating this slide.", cannotDelete: "Cannot delete slide", cannotDeleteDescription: "A template needs at least one layout.", reconstructed: "Slide reconstructed", reconstructedDescription: (p) => `Slide ${p.number} was reconstructed. Save to keep it.`, reconstructFailed: "Failed to reconstruct slide", reconstructFallback: "Something went wrong while reconstructing this slide.", createLayoutFirst: "Create a layout first", createLayoutFirstDescription: "Add a blank layout before inserting content.", createBlankLayout: "Create blank layout", insertUnavailable: "Insert unavailable", selectActiveLayout: "Select the active layout and try again.", componentUnavailable: "Component unavailable", componentUnavailableDescription: "This merged component cannot be inserted yet.", saveFallback: "Something went wrong while saving the template.", deleteFallback: "Something went wrong while deleting the template." },
    panels: { blocks: "Blocks", texts: "Texts", charts: "Charts", tables: "Tables", images: "Images", elements: "Elements", schema: "Schema", layouts: "Layouts", chartType: "Chart Type", infographics: "Infographics", tableType: "Table Type", shorter: "Make it shorter", engaging: "Make it more engaging", add: "Add", aiOptions: "AI options", send: "Send", aiQuestion: "What can I do for your deck today?", aiPlaceholder: "Ask anything.\nType / to get Quick prompts.", resetDensity: "Reset content density preview", restoreOriginal: "Restore the original slide content", reset: "Reset", content: "Content", decorative: "Decorative", type: "Type", minChars: "Min Chars", maxChars: "Max Chars", prompt: "Prompt", list: "List", icon: "Icon", image: "Image", string: "String", low: "Low", medium: "Medium", high: "High", densitySelected: (p) => `${p.density} content density selected`, densityPreview: (p) => `Preview ${p.density} content density`, schemaEditor: "Schema Editor", contentDensity: "Content Density", densityHint: "Preview realistic content lengths without changing your saved template. Reset restores the original content.", noSchema: "No schema elements were found for this layout.", noGroupElements: (p) => `No ${p.group} elements.`, characters: (p) => `${p.count} Characters`, setDecorative: (p) => `Set ${p.field} decorative`, decorativeHint: "Decorative elements are read-only. Turn off Decorative to edit their content or constraints.", noEditableElement: "This element has no editable content. Its decorative role can still be changed." },
    warning: { title: "Template model warning", description: "Template V2 works best with vision-capable models. Use a recent OpenAI vision model or a Gemini vision model for reliable template generation.", dismiss: "Don't show again" },
  },
} satisfies Catalog;

export default en;
