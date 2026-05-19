import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { readFileSync } from "fs";

const app = initializeApp(JSON.parse(readFileSync("./firebase-applet-config.json", "utf-8")));
const db = getFirestore(app);

getDocs(collection(db, "events")).then(qs => {
  qs.forEach(d => {
    let date = "No Date";
    if (d.data().date && d.data().date.toDate) {
      date = d.data().date.toDate();
    }
    console.log(date, d.data().name, d.data().categoryStats);
  });
}).catch(e => console.error(e));
