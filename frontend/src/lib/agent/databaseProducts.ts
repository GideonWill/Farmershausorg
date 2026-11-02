// Authoritative Catalogue Data synchronized with Django SQLite database
import type { ProductSearchResult } from './types.ts'

export interface RealProduct extends ProductSearchResult {
  branchStocks: Record<string, number>
}

export const REAL_DATABASE_PRODUCTS: RealProduct[] = [
  {
    "id": "df999d48-5d0a-4788-9c7f-525c4b1e4b79",
    "slug": "apple",
    "name": "Apple",
    "category": "fruits",
    "priceMinor": 700,
    "priceFormatted": "GH₵ 7.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "/products/apple.jpg",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "9117d5cb-a9aa-4869-aad9-1a4e9c97a2b2",
    "slug": "avocado",
    "name": "Avocado",
    "category": "fruits",
    "priceMinor": 800,
    "priceFormatted": "GH₵ 8.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 47,
    "imageUrl": "/products/avocado.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 2,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "0eae6e12-56ce-4222-a3a2-67690d55a04b",
    "slug": "banana",
    "name": "Banana",
    "category": "fruits",
    "priceMinor": 1500,
    "priceFormatted": "GH₵ 15.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 37,
    "imageUrl": "/products/banana.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 1,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "a0f3446b-6918-4720-973f-a20430ccb604",
    "slug": "black-eyed-peas",
    "name": "Black-eyed peas",
    "category": "grains",
    "priceMinor": 2100,
    "priceFormatted": "GH₵ 21.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "a43e666c-a224-473e-935e-6c6be16bf28b",
    "slug": "bottled-water",
    "name": "Bottled water",
    "category": "beverages",
    "priceMinor": 700,
    "priceFormatted": "GH₵ 7.00",
    "unit": "1.5 L bottle",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 28,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 0
    }
  },
  {
    "id": "e4633d80-f236-41fc-82b5-5c5d91e17439",
    "slug": "broccoli",
    "name": "Broccoli",
    "category": "vegetables",
    "priceMinor": 2600,
    "priceFormatted": "GH₵ 26.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 33,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 0,
      "east-legon": 10,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "b83b8de7-74b2-4d28-bd2c-d0d4b87a8ffd",
    "slug": "brown-beans",
    "name": "Brown beans",
    "category": "grains",
    "priceMinor": 2200,
    "priceFormatted": "GH₵ 22.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 36,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 0,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "6d3fe059-334c-44d9-b93f-92ca35a97e66",
    "slug": "brown-rice",
    "name": "Brown rice",
    "category": "grains",
    "priceMinor": 3000,
    "priceFormatted": "GH₵ 30.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 42,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 0,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "9bfc1361-6cb8-40db-a624-78b7fd168353",
    "slug": "cabbage",
    "name": "Cabbage",
    "category": "vegetables",
    "priceMinor": 1200,
    "priceFormatted": "GH₵ 12.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 58,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "3be791fe-1759-4073-a718-a07e474eab4a",
    "slug": "cane-sugar",
    "name": "Cane sugar",
    "category": "pantry",
    "priceMinor": 1600,
    "priceFormatted": "GH₵ 16.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 50,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 0,
      "westland": 21
    }
  },
  {
    "id": "da3ab0f7-09fe-41c8-9d73-1dfd1eaaafb9",
    "slug": "carrots",
    "name": "Carrots",
    "category": "vegetables",
    "priceMinor": 1500,
    "priceFormatted": "GH₵ 15.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 37,
    "imageUrl": "",
    "tags": [
      "in-season",
      "organic"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 1,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "c051738e-4ed8-41b8-a04e-93c3ceb72b21",
    "slug": "cassava",
    "name": "Cassava",
    "category": "roots",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 40,
    "imageUrl": "",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "988dfe73-c410-42a0-afe9-475f4700b685",
    "slug": "cassava-flour",
    "name": "Cassava flour",
    "category": "pantry",
    "priceMinor": 1800,
    "priceFormatted": "GH₵ 18.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "998abc21-9a15-4091-96dc-5a43641309f9",
    "slug": "cauliflower",
    "name": "Cauliflower",
    "category": "vegetables",
    "priceMinor": 2500,
    "priceFormatted": "GH₵ 25.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 45,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 0,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "e1b00f8a-98b6-4458-b6b0-bfddb970cc37",
    "slug": "cheddar-cheese",
    "name": "Cheddar cheese",
    "category": "dairy-eggs",
    "priceMinor": 4200,
    "priceFormatted": "GH₵ 42.00",
    "unit": "200 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 36,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 0,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "c820aab7-f37c-4e76-bc51-29529aebebf5",
    "slug": "cocoa-drink",
    "name": "Cocoa drink",
    "category": "beverages",
    "priceMinor": 3600,
    "priceFormatted": "GH₵ 36.00",
    "unit": "500 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "6dc265c0-e67c-4703-a2a2-be9c2e83325e",
    "slug": "coconut",
    "name": "Coconut",
    "category": "fruits",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "/products/coconut.jpg",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "37dd6076-5946-42d3-92f9-131aff4354a7",
    "slug": "coconut-water",
    "name": "Coconut water",
    "category": "beverages",
    "priceMinor": 1500,
    "priceFormatted": "GH₵ 15.00",
    "unit": "500 ml bottle",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 58,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "2309ac37-2f28-4784-9547-95949f66551c",
    "slug": "cocoyam",
    "name": "Cocoyam",
    "category": "roots",
    "priceMinor": 1600,
    "priceFormatted": "GH₵ 16.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 37,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 0
    }
  },
  {
    "id": "c3ba126d-9ff3-463d-aece-09c11d7e1d3f",
    "slug": "coriander",
    "name": "Coriander",
    "category": "herbs",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "bunch",
    "unitType": "bunch",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 27,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 0,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "015572f9-3113-4254-a817-cf7c59f1838f",
    "slug": "cucumber",
    "name": "Cucumber",
    "category": "vegetables",
    "priceMinor": 700,
    "priceFormatted": "GH₵ 7.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "c9e79a4c-4c50-4378-b1e3-c321f5020a8b",
    "slug": "farm-eggs",
    "name": "Farm eggs",
    "category": "dairy-eggs",
    "priceMinor": 3500,
    "priceFormatted": "GH₵ 35.00",
    "unit": "tray",
    "unitType": "tray",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 6
    }
  },
  {
    "id": "2b8c6330-1935-4940-9042-d713ec460c7d",
    "slug": "fresh-milk",
    "name": "Fresh milk",
    "category": "dairy-eggs",
    "priceMinor": 2800,
    "priceFormatted": "GH₵ 28.00",
    "unit": "1 L carton",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 37,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 0
    }
  },
  {
    "id": "5113b84e-08d0-4e73-9552-85bf0c731d87",
    "slug": "fresh-orange-juice",
    "name": "Fresh orange juice",
    "category": "beverages",
    "priceMinor": 3800,
    "priceFormatted": "GH₵ 38.00",
    "unit": "1 L bottle",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season",
      "organic"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "53ed321b-4c6d-44ea-af88-0312f306dd6d",
    "slug": "fresh-pepper",
    "name": "Fresh pepper",
    "category": "vegetables",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "250 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 43,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 1,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "ac50f0af-e3d8-4789-8af8-3788ce661867",
    "slug": "garden-eggs",
    "name": "Garden eggs",
    "category": "vegetables",
    "priceMinor": 1800,
    "priceFormatted": "GH₵ 18.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 29,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 1
    }
  },
  {
    "id": "38a7a44c-0ce0-4b4e-bbaa-714898dcbb66",
    "slug": "garlic",
    "name": "Garlic",
    "category": "roots",
    "priceMinor": 1400,
    "priceFormatted": "GH₵ 14.00",
    "unit": "250 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 36,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 0,
      "north-legon": 11,
      "westland": 6
    }
  },
  {
    "id": "961b747f-9d8d-4cdc-b433-ed7859964e7d",
    "slug": "ginger",
    "name": "Ginger",
    "category": "roots",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "250 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 43,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 1,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "eff2cf7f-340e-415d-ba1a-33e0dd71ddab",
    "slug": "grapes",
    "name": "Grapes",
    "category": "fruits",
    "priceMinor": 3200,
    "priceFormatted": "GH₵ 32.00",
    "unit": "500 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 33,
    "imageUrl": "/products/grapes.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 0,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "1d6a06e2-d63e-45f2-9690-50b236d2f4e2",
    "slug": "groundnut-oil",
    "name": "Groundnut oil",
    "category": "pantry",
    "priceMinor": 4200,
    "priceFormatted": "GH₵ 42.00",
    "unit": "1 L bottle",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 0
    }
  },
  {
    "id": "24f3394e-0cc5-4522-af1a-effd19508fa1",
    "slug": "irish-potato",
    "name": "Irish potato",
    "category": "roots",
    "priceMinor": 1700,
    "priceFormatted": "GH₵ 17.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 23,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 0,
      "westland": 12
    }
  },
  {
    "id": "70081c78-379d-4ed0-878e-e5c59e08ed24",
    "slug": "kontomire",
    "name": "Kontomire",
    "category": "herbs",
    "priceMinor": 700,
    "priceFormatted": "GH₵ 7.00",
    "unit": "bunch",
    "unitType": "bunch",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "be29471f-c687-43fd-a6f3-7f1442359cf3",
    "slug": "lemon",
    "name": "Lemon",
    "category": "fruits",
    "priceMinor": 500,
    "priceFormatted": "GH₵ 5.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "/products/lemon.jpg",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 2,
      "westland": 21
    }
  },
  {
    "id": "60437dc6-4c78-4c12-bfd3-edb25f3e8b33",
    "slug": "lentils",
    "name": "Lentils",
    "category": "grains",
    "priceMinor": 2500,
    "priceFormatted": "GH₵ 25.00",
    "unit": "500 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 41,
    "imageUrl": "",
    "tags": [
      "in-season",
      "organic"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 0,
      "westland": 18
    }
  },
  {
    "id": "79c3c272-c012-4b24-a585-1c86c6874fe4",
    "slug": "lettuce",
    "name": "Lettuce",
    "category": "vegetables",
    "priceMinor": 900,
    "priceFormatted": "GH₵ 9.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 42,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 1,
      "westland": 6
    }
  },
  {
    "id": "95833dd8-2d05-4c03-9473-866b023229e4",
    "slug": "local-rice",
    "name": "Local rice",
    "category": "grains",
    "priceMinor": 2400,
    "priceFormatted": "GH₵ 24.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 33,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 1,
      "westland": 15
    }
  },
  {
    "id": "7c8bc72c-348d-46fb-a43b-03e2ff7b23df",
    "slug": "maize",
    "name": "Maize",
    "category": "grains",
    "priceMinor": 1400,
    "priceFormatted": "GH₵ 14.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "20aadba5-6713-45e8-a233-f43ba8cd7a46",
    "slug": "mango",
    "name": "Mango",
    "category": "fruits",
    "priceMinor": 900,
    "priceFormatted": "GH₵ 9.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "/products/mango.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "08424712-a4bb-4a4f-8636-f5938a0ae0cc",
    "slug": "mierikswortel",
    "name": "Mierikswortel (Horseradish)",
    "category": "pantry",
    "priceMinor": 4599,
    "priceFormatted": "GH₵ 45.99",
    "unit": "175 g jar",
    "unitType": "pack",
    "origin": "Germany",
    "isAvailable": true,
    "availableQuantity": 100,
    "imageUrl": "/products/mierikswortel.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 25,
      "east-legon": 25,
      "north-legon": 25,
      "westland": 25
    }
  },
  {
    "id": "37867b69-db71-4305-9c03-6beb2fbb1244",
    "slug": "millet",
    "name": "Millet",
    "category": "grains",
    "priceMinor": 1800,
    "priceFormatted": "GH₵ 18.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 37,
    "imageUrl": "",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 0
    }
  },
  {
    "id": "3e7a6a44-4cc3-47fb-9732-53dcf25fed71",
    "slug": "mint",
    "name": "Mint",
    "category": "herbs",
    "priceMinor": 900,
    "priceFormatted": "GH₵ 9.00",
    "unit": "bunch",
    "unitType": "bunch",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 40,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "bf1b855f-6f3b-49ef-84ed-1ce99511616f",
    "slug": "natural-honey",
    "name": "Natural honey",
    "category": "pantry",
    "priceMinor": 4500,
    "priceFormatted": "GH₵ 45.00",
    "unit": "500 g jar",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 45,
    "imageUrl": "",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 10,
      "east-legon": 0,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "cf0a14db-8b3a-4f75-bb02-93477811b3f3",
    "slug": "okra",
    "name": "Okra",
    "category": "vegetables",
    "priceMinor": 900,
    "priceFormatted": "GH₵ 9.00",
    "unit": "500 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 10,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "dd1ad89a-4a8b-4cb2-bd24-7a342d3551cc",
    "slug": "onions",
    "name": "Onions",
    "category": "vegetables",
    "priceMinor": 1400,
    "priceFormatted": "GH₵ 14.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 40,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "c2830ac0-9b8f-4e51-a34a-f6d8b73182c5",
    "slug": "orange",
    "name": "Orange",
    "category": "fruits",
    "priceMinor": 1800,
    "priceFormatted": "GH₵ 18.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 47,
    "imageUrl": "/products/orange.jpg",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 1
    }
  },
  {
    "id": "1bce6785-53c7-4561-a4e3-659663fbf810",
    "slug": "parsley",
    "name": "Parsley",
    "category": "herbs",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "bunch",
    "unitType": "bunch",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 33,
    "imageUrl": "",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 0,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 6
    }
  },
  {
    "id": "d8bc6253-3736-433b-95b6-450c7a612ded",
    "slug": "pawpaw",
    "name": "Pawpaw",
    "category": "fruits",
    "priceMinor": 1100,
    "priceFormatted": "GH₵ 11.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 41,
    "imageUrl": "/products/pawpaw.jpg",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 0,
      "westland": 18
    }
  },
  {
    "id": "f93139c1-3561-4d47-9825-5095808b2aa7",
    "slug": "peanut-butter",
    "name": "Peanut butter",
    "category": "pantry",
    "priceMinor": 2600,
    "priceFormatted": "GH₵ 26.00",
    "unit": "350 g jar",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 33,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 0,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "b3916235-423f-42a9-971c-c568cb7545d8",
    "slug": "pineapple",
    "name": "Pineapple",
    "category": "fruits",
    "priceMinor": 1200,
    "priceFormatted": "GH₵ 12.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 43,
    "imageUrl": "/products/pineapple.jpg",
    "tags": [
      "in-season",
      "organic"
    ],
    "branchStocks": {
      "dome": 1,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "31b8396b-cd69-408f-8b7b-23f7341cb8d9",
    "slug": "plain-yoghurt",
    "name": "Plain yoghurt",
    "category": "dairy-eggs",
    "priceMinor": 2400,
    "priceFormatted": "GH₵ 24.00",
    "unit": "500 ml tub",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 40,
    "imageUrl": "",
    "tags": [
      "organic"
    ],
    "branchStocks": {
      "dome": 7,
      "east-legon": 4,
      "north-legon": 17,
      "westland": 12
    }
  },
  {
    "id": "143ddb92-103a-4117-a9bb-e6427cd4bae5",
    "slug": "red-kidney-beans",
    "name": "Red kidney beans",
    "category": "pantry",
    "priceMinor": 2399,
    "priceFormatted": "GH₵ 23.99",
    "unit": "400 g can",
    "unitType": "pack",
    "origin": "Italy",
    "isAvailable": true,
    "availableQuantity": 100,
    "imageUrl": "/products/red-kidney-beans.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 25,
      "east-legon": 25,
      "north-legon": 25,
      "westland": 25
    }
  },
  {
    "id": "06f67321-5187-4ecb-93c5-cb2734b241ff",
    "slug": "red-palm-oil",
    "name": "Red palm oil",
    "category": "pantry",
    "priceMinor": 3200,
    "priceFormatted": "GH₵ 32.00",
    "unit": "1 L bottle",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 58,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "33d19377-541a-483e-a9ad-3f5a214024bc",
    "slug": "remia-salad-dressing",
    "name": "Remia Salad Dressing",
    "category": "pantry",
    "priceMinor": 4450,
    "priceFormatted": "GH₵ 44.50",
    "unit": "250 ml bottle",
    "unitType": "volume",
    "origin": "Netherlands",
    "isAvailable": true,
    "availableQuantity": 100,
    "imageUrl": "/products/remia-salad-dressing.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 25,
      "east-legon": 25,
      "north-legon": 25,
      "westland": 25
    }
  },
  {
    "id": "a0a05f4e-c0db-4017-85c8-091120224442",
    "slug": "salted-butter",
    "name": "Salted butter",
    "category": "dairy-eggs",
    "priceMinor": 2600,
    "priceFormatted": "GH₵ 26.00",
    "unit": "200 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 42,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 0,
      "east-legon": 7,
      "north-legon": 20,
      "westland": 15
    }
  },
  {
    "id": "ce276cf5-5695-445a-a4bf-00c8ceb073f2",
    "slug": "sobolo-drink",
    "name": "Sobolo drink",
    "category": "beverages",
    "priceMinor": 1200,
    "priceFormatted": "GH₵ 12.00",
    "unit": "500 ml bottle",
    "unitType": "volume",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 41,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 0,
      "westland": 6
    }
  },
  {
    "id": "0f6e51c4-7f99-4681-b9fc-2ff854ef5901",
    "slug": "sorghum",
    "name": "Sorghum",
    "category": "grains",
    "priceMinor": 1600,
    "priceFormatted": "GH₵ 16.00",
    "unit": "1 kg pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 6
    }
  },
  {
    "id": "2e1e3275-b85e-48f6-b648-fc02e2caaef7",
    "slug": "spanish-black-olives",
    "name": "Spanish Black Olives",
    "category": "pantry",
    "priceMinor": 4699,
    "priceFormatted": "GH₵ 46.99",
    "unit": "340 g jar",
    "unitType": "pack",
    "origin": "Spain",
    "isAvailable": true,
    "availableQuantity": 100,
    "imageUrl": "/products/spanish-black-olives.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 25,
      "east-legon": 25,
      "north-legon": 25,
      "westland": 25
    }
  },
  {
    "id": "a2626bb8-bb29-4627-96bd-9cd9dd7b968b",
    "slug": "spanish-green-olives",
    "name": "Spanish Green Olives",
    "category": "pantry",
    "priceMinor": 4699,
    "priceFormatted": "GH₵ 46.99",
    "unit": "340 g jar",
    "unitType": "pack",
    "origin": "Spain",
    "isAvailable": true,
    "availableQuantity": 100,
    "imageUrl": "/products/spanish-green-olives.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 25,
      "east-legon": 25,
      "north-legon": 25,
      "westland": 25
    }
  },
  {
    "id": "1f76be53-135b-47a0-9447-64cd8edd512c",
    "slug": "spinach",
    "name": "Spinach",
    "category": "herbs",
    "priceMinor": 1000,
    "priceFormatted": "GH₵ 10.00",
    "unit": "bunch",
    "unitType": "bunch",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 28,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 5,
      "westland": 0
    }
  },
  {
    "id": "5ef52b1d-8611-45a1-ba4f-03898ddcbd06",
    "slug": "spring-onion",
    "name": "Spring onion",
    "category": "herbs",
    "priceMinor": 800,
    "priceFormatted": "GH₵ 8.00",
    "unit": "bunch",
    "unitType": "bunch",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 58,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "b671254c-ef6f-4e5d-8c83-9237f3ebb7e2",
    "slug": "strawberry",
    "name": "Strawberry",
    "category": "fruits",
    "priceMinor": 3500,
    "priceFormatted": "GH₵ 35.00",
    "unit": "250 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "/products/strawberry.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 6
    }
  },
  {
    "id": "082bae58-dd2d-4f98-92d1-4f9ae70aa17e",
    "slug": "sweet-corn",
    "name": "Sweet corn",
    "category": "vegetables",
    "priceMinor": 800,
    "priceFormatted": "GH₵ 8.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 52,
    "imageUrl": "",
    "tags": [],
    "branchStocks": {
      "dome": 19,
      "east-legon": 16,
      "north-legon": 11,
      "westland": 6
    }
  },
  {
    "id": "2a8766ec-0e0d-4061-8a74-cbe3641dc555",
    "slug": "sweet-potato",
    "name": "Sweet potato",
    "category": "roots",
    "priceMinor": 1300,
    "priceFormatted": "GH₵ 13.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 13,
      "east-legon": 10,
      "north-legon": 5,
      "westland": 18
    }
  },
  {
    "id": "f03d48f5-b49c-450c-ae75-b1003c9057f1",
    "slug": "tomato-paste",
    "name": "Tomato paste",
    "category": "pantry",
    "priceMinor": 1800,
    "priceFormatted": "GH₵ 18.00",
    "unit": "400 g tin",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "2c972fa8-2c3b-44ad-b296-ad29cbada81a",
    "slug": "tomatoes",
    "name": "Tomatoes",
    "category": "vegetables",
    "priceMinor": 1600,
    "priceFormatted": "GH₵ 16.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 39,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 2
    }
  },
  {
    "id": "d908af42-6793-4489-a9d7-bc08eac99e0d",
    "slug": "turmeric",
    "name": "Turmeric",
    "category": "roots",
    "priceMinor": 1200,
    "priceFormatted": "GH₵ 12.00",
    "unit": "250 g pack",
    "unitType": "pack",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 46,
    "imageUrl": "",
    "tags": [
      "in-season",
      "organic"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 14,
      "westland": 9
    }
  },
  {
    "id": "f75df381-e4a4-4ef2-9547-c42ae1e5c709",
    "slug": "watermelon",
    "name": "Watermelon",
    "category": "fruits",
    "priceMinor": 2500,
    "priceFormatted": "GH₵ 25.00",
    "unit": "each",
    "unitType": "piece",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 58,
    "imageUrl": "/products/watermelon.jpg",
    "tags": [],
    "branchStocks": {
      "dome": 16,
      "east-legon": 13,
      "north-legon": 8,
      "westland": 21
    }
  },
  {
    "id": "bb4c0220-5391-4a64-b6c1-046233e9dad1",
    "slug": "white-yam",
    "name": "White yam",
    "category": "roots",
    "priceMinor": 1800,
    "priceFormatted": "GH₵ 18.00",
    "unit": "kg",
    "unitType": "weight",
    "origin": "Ghana / Imported Partner",
    "isAvailable": true,
    "availableQuantity": 32,
    "imageUrl": "",
    "tags": [
      "in-season"
    ],
    "branchStocks": {
      "dome": 4,
      "east-legon": 19,
      "north-legon": 0,
      "westland": 9
    }
  }
]
