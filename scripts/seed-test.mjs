if (process.env.QUEUEPROOF_TEST_MODE !== "true") {
  console.error("Refusing fixtures outside QUEUEPROOF_TEST_MODE=true.");
  process.exit(2);
}
console.log("Fixture mode enabled. Production stores remain untouched.");

