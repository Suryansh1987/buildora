// backend/buildRunner.js
const { exec } = require("child_process");
const path = require("path");

const zipUrl = "https://zewahrnmtqehbaduaewy.supabase.co/storage/v1/object/public/zipprojects/archives/proj123.zip"; // <-- inject this dynamically if needed

// Run docker build
exec(
  `docker build --build-arg ZIP_URL="${zipUrl}" -t react-builder .`,
  { cwd: path.resolve(__dirname) }, // run from /backend
  (err, stdout, stderr) => {
    if (err) {
      console.error("❌ Build failed:", stderr);
      return;
    }

    console.log("✅ Build completed. Output:");
    console.log(stdout);

    // Run the container and mount output folder
    exec(
      `docker run --rm -v ${path.resolve(__dirname, "output")}:/app/dist react-builder`,
      (err, stdout, stderr) => {
        if (err) {
          console.error("❌ Run failed:", stderr);
          return;
        }

        console.log("✅ Build output is in /backend/output");
      }
    );
  }
);
