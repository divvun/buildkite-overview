
// query {
//   organization(slug: "divvun") {
//     id
//     pipelines(first: 100) {
//       count
//       edges {
//         node {
//           repository {
//             url
//           }
//           id
//           name
//           visibility
//           tags {
//             label
//           }
//           url
//           builds(last: 10) {
//             count
//             edges {
//               node {
//                 state
//                 url
//                 startedAt
//                 finishedAt
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }