console.error("Large-PDF generation is test-only.");
process.exit(process.env.QUEUEPROOF_TEST_MODE === "true" ? 0 : 2);
