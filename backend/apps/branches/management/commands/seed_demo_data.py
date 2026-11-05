import os
from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import BranchMembership, User
from apps.baskets.models import BasketCategory, BasketComponent, BasketPackage
from apps.branches.models import Branch, DeliveryZone
from apps.catalogue.models import Category, Product, ProductTag
from apps.content.models import SiteSettings
from apps.inventory.models import ProductBranch
from apps.orders.models import CustomerAddress, FulfillmentSlot


BRANCHES = (
    {
        "slug": "dome",
        "name": "FarmersHaus Dome",
        "address": "Aggrey Street, Dome, Accra",
        "latitude": 5.655423,
        "longitude": -0.232884,
    },
    {
        "slug": "westland",
        "name": "FarmersHaus Westland",
        "address": "14 Ato Ahwoi Ave, Westland Junction, Accra",
        "latitude": 5.650075,
        "longitude": -0.209906,
    },
    {
        "slug": "north-legon",
        "name": "FarmersHaus North Legon",
        "address": "Wisconsin Road, Adjacent Antis, North Legon, Accra",
        "latitude": 5.670448,
        "longitude": -0.181634,
    },
    {
        "slug": "east-legon",
        "name": "FarmersHaus East Legon",
        "address": "ARS Roundabout, East Legon, Accra",
        "latitude": 5.659954,
        "longitude": -0.151446,
    },
)

CATEGORY_PRODUCTS = {
    "fruits": (
        ("Pineapple", "each", "piece", 1200),
        ("Banana", "kg", "weight", 1500),
        ("Mango", "each", "piece", 900),
        ("Pawpaw", "each", "piece", 1100),
        ("Watermelon", "each", "piece", 2500),
        ("Orange", "kg", "weight", 1800),
        ("Apple", "each", "piece", 700),
        ("Grapes", "500 g pack", "pack", 3200),
        ("Avocado", "each", "piece", 800),
        ("Coconut", "each", "piece", 1000),
        ("Lemon", "each", "piece", 500),
        ("Strawberry", "250 g pack", "pack", 3500),
    ),
    "vegetables": (
        ("Tomatoes", "kg", "weight", 1600),
        ("Onions", "kg", "weight", 1400),
        ("Fresh pepper", "250 g pack", "pack", 1000),
        ("Carrots", "kg", "weight", 1500),
        ("Cabbage", "each", "piece", 1200),
        ("Lettuce", "each", "piece", 900),
        ("Cucumber", "each", "piece", 700),
        ("Garden eggs", "kg", "weight", 1800),
        ("Okra", "500 g pack", "pack", 900),
        ("Broccoli", "each", "piece", 2600),
        ("Cauliflower", "each", "piece", 2500),
        ("Sweet corn", "each", "piece", 800),
    ),
    "roots": (
        ("White yam", "kg", "weight", 1800),
        ("Cassava", "kg", "weight", 1000),
        ("Cocoyam", "kg", "weight", 1600),
        ("Sweet potato", "kg", "weight", 1300),
        ("Ginger", "250 g pack", "pack", 1000),
        ("Garlic", "250 g pack", "pack", 1400),
        ("Turmeric", "250 g pack", "pack", 1200),
        ("Irish potato", "kg", "weight", 1700),
    ),
    "herbs": (
        ("Kontomire", "bunch", "bunch", 700),
        ("Spinach", "bunch", "bunch", 1000),
        ("Spring onion", "bunch", "bunch", 800),
        ("Parsley", "bunch", "bunch", 1000),
        ("Coriander", "bunch", "bunch", 1000),
        ("Mint", "bunch", "bunch", 900),
    ),
    "grains": (
        ("Local rice", "1 kg pack", "pack", 2400),
        ("Maize", "1 kg pack", "pack", 1400),
        ("Millet", "1 kg pack", "pack", 1800),
        ("Sorghum", "1 kg pack", "pack", 1600),
        ("Brown rice", "1 kg pack", "pack", 3000),
        ("Brown beans", "1 kg pack", "pack", 2200),
        ("Black-eyed peas", "1 kg pack", "pack", 2100),
        ("Lentils", "500 g pack", "pack", 2500),
    ),
    "pantry": (
        ("Red palm oil", "1 L bottle", "volume", 3200),
        ("Groundnut oil", "1 L bottle", "volume", 4200),
        ("Tomato paste", "400 g tin", "pack", 1800),
        ("Peanut butter", "350 g jar", "pack", 2600),
        ("Natural honey", "500 g jar", "pack", 4500),
        ("Cassava flour", "1 kg pack", "pack", 1800),
        ("Cane sugar", "1 kg pack", "pack", 1600),
        ("Red kidney beans", "400 g can", "pack", 2399),
        ("Mierikswortel (Horseradish)", "175 g jar", "pack", 4599),
        ("Remia Salad Dressing", "250 ml bottle", "volume", 4450),
        ("Spanish Black Olives", "340 g jar", "pack", 4699),
        ("Spanish Green Olives", "340 g jar", "pack", 4699),
    ),
    "dairy-eggs": (
        ("Farm eggs", "tray", "tray", 3500),
        ("Fresh milk", "1 L carton", "volume", 2800),
        ("Plain yoghurt", "500 ml tub", "volume", 2400),
        ("Salted butter", "200 g pack", "pack", 2600),
        ("Cheddar cheese", "200 g pack", "pack", 4200),
    ),
    "beverages": (
        ("Coconut water", "500 ml bottle", "volume", 1500),
        ("Sobolo drink", "500 ml bottle", "volume", 1200),
        ("Fresh orange juice", "1 L bottle", "volume", 3800),
        ("Bottled water", "1.5 L bottle", "volume", 700),
        ("Cocoa drink", "500 g pack", "pack", 3600),
    ),
}

TAG_NAMES = {
    "organic": "Organic",
    "in-season": "In season",
}

PLACEHOLDER_HOURS = {
    day: {"open": "09:00", "close": "18:00"}
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday")
}

DEMO_BASKETS = (
    {
        "slug": "fresh-fruit-basket",
        "sku": "FH-DEMO-BASKET-FRUIT",
        "name": "Fresh Fruit Basket",
        "category": ("fresh-fruit", "Fresh Fruit"),
        "description": "A colorful fruit selection for sharing at home.",
        "components": (
            ("pineapple", 1),
            ("banana", 1),
            ("orange", 1),
            ("apple", 2),
            ("avocado", 2),
        ),
    },
    {
        "slug": "everyday-veggie-basket",
        "sku": "FH-DEMO-BASKET-VEGGIE",
        "name": "Everyday Veggie Basket",
        "category": ("everyday-vegetables", "Everyday Vegetables"),
        "description": "Everyday vegetables for fresh, home-cooked meals.",
        "components": (
            ("tomatoes", 2),
            ("onions", 1),
            ("carrots", 1),
            ("cabbage", 1),
            ("fresh-pepper", 1),
            ("lettuce", 1),
        ),
    },
    {
        "slug": "family-market-basket",
        "sku": "FH-DEMO-BASKET-FAMILY",
        "name": "Family Market Basket",
        "category": ("family-market", "Family Market"),
        "description": "A generous mix of fresh produce and everyday staples.",
        "components": (
            ("tomatoes", 2),
            ("onions", 1),
            ("banana", 1),
            ("pineapple", 1),
            ("sweet-potato", 2),
            ("local-rice", 1),
            ("farm-eggs", 1),
        ),
    },
    {
        "slug": "crunchy-salad-basket",
        "sku": "FH-DEMO-BASKET-SALAD",
        "name": "Crunchy Salad Basket",
        "category": ("crunchy-salad", "Crunchy Salad"),
        "description": "Crisp, colorful produce for a fresh salad at home.",
        "components": (
            ("tomatoes", 1),
            ("cucumber", 2),
            ("lettuce", 1),
            ("carrots", 1),
            ("spring-onion", 1),
            ("lemon", 2),
        ),
    },
    {
        "slug": "ghanaian-soup-starter-basket",
        "sku": "FH-DEMO-BASKET-SOUP",
        "name": "Ghanaian Soup Starter Basket",
        "category": ("soup-starters", "Soup Starters"),
        "description": "Fresh local staples to get a comforting soup started.",
        "components": (
            ("tomatoes", 2),
            ("onions", 2),
            ("fresh-pepper", 1),
            ("kontomire", 1),
            ("garden-eggs", 1),
            ("okra", 1),
            ("ginger", 1),
        ),
    },
)


PRODUCT_IMAGES = {
    "apple": ("/products/apple.jpg", []),
    "banana": ("/products/banana.jpg", []),
    "grapes": ("/products/grapes.jpg", []),
    "mango": ("/products/mango.jpg", []),
    "pineapple": ("/products/pineapple.jpg", []),
    "avocado": ("/products/avocado.jpg", []),
    "lemon": ("/products/lemon.jpg", []),
    "pawpaw": ("/products/pawpaw.jpg", []),
    "orange": ("/products/orange.jpg", []),
    "coconut": ("/products/coconut.jpg", []),
    "strawberry": ("/products/strawberry.jpg", []),
    "watermelon": ("/products/watermelon.jpg", []),
    "red-kidney-beans": ("/products/red-kidney-beans.jpg", ["/products/red-kidney-beans-promo.jpg"]),
    "mierikswortel": ("/products/mierikswortel.jpg", ["/products/mierikswortel-promo.jpg"]),
    "mierikswortel-(horseradish)": ("/products/mierikswortel.jpg", ["/products/mierikswortel-promo.jpg"]),
    "remia-salad-dressing": ("/products/remia-salad-dressing.jpg", ["/products/remia-salad-dressing-promo.jpg"]),
    "spanish-black-olives": ("/products/spanish-black-olives.jpg", ["/products/spanish-olives-promo.jpg"]),
    "spanish-green-olives": ("/products/spanish-green-olives.jpg", ["/products/spanish-olives-promo.jpg"]),
    "broccoli": ("/products/broccoli.jpg", []),
    "cabbage": ("/products/cabbage.jpg", []),
    "carrots": ("/products/carrots.jpg", []),
    "cauliflower": ("/products/cauliflower.jpg", []),
    "cucumber": ("/products/cucumber.jpg", []),
    "fresh-pepper": ("/products/fresh-pepper.jpg", []),
    "garden-eggs": ("/products/garden-eggs.jpg", []),
    "lettuce": ("/products/lettuce.jpg", []),
    "okra": ("/products/okra.jpg", []),
    "onions": ("/products/onions.jpg", []),
    "sweet-corn": ("/products/sweet-corn.jpg", []),
    "tomatoes": ("/products/tomatoes.jpg", []),
    "cassava": ("/products/cassava.jpg", []),
    "cocoyam": ("/products/cocoyam.jpg", []),
    "garlic": ("/products/garlic.jpg", []),
    "ginger": ("/products/ginger.jpg", []),
    "irish-potato": ("/products/irish-potato.jpg", []),
    "turmeric": ("/products/turmeric.jpg", []),
    "white-yam": ("/products/white-yam.jpg", []),
    "yam": ("/products/white-yam.jpg", []),
    "coriander": ("/products/coriander.jpg", []),
    "kontomire": ("/products/kontomire.jpg", []),
    "mint": ("/products/mint.jpg", []),
    "parsley": ("/products/parsley.jpg", []),
    "spinach": ("/products/spinach.jpg", []),
    "spring-onion": ("/products/spring-onion.jpg", []),
    "black-eyed-peas": ("/products/black-eyed-peas.jpg", []),
    "brown-beans": ("/products/brown-beans.jpg", []),
    "brown-rice": ("/products/brown-rice.jpg", []),
    "lentils": ("/products/lentils.jpg", []),
    "local-rice": ("/products/local-rice.jpg", []),
    "maize": ("/products/maize.jpg", []),
    "millet": ("/products/millet.jpg", []),
    "sorghum": ("/products/sorghum.jpg", []),
    "sugarcane": ("/products/sugarcane.jpg", []),
    "cane-sugar": ("/products/cane-sugar.jpg", []),
    "cassava-flour": ("/products/cassava-flour.jpg", []),
    "groundnut-oil": ("/products/groundnut-oil.jpg", []),
}


class Command(BaseCommand):
    help = "Create launch branches, demo catalogue, ready-made baskets, branch stock, and role test accounts."

    def add_arguments(self, parser):
        parser.add_argument("--password", default=os.getenv("FARMERSHAUS_SEED_PASSWORD"))

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Demo seeding is available only with development settings.")
        password = options["password"]
        if not password or len(password) < 12:
            raise CommandError(
                "Set FARMERSHAUS_SEED_PASSWORD (at least 12 characters) or pass --password."
            )

        branches = self.seed_branches()
        products = self.seed_products()
        self.seed_inventory(branches, products)
        baskets = self.seed_baskets(products, branches)
        self.seed_delivery_zones(branches)
        self.seed_fulfillment_slots(branches)
        self.seed_test_users(password, branches["dome"])
        SiteSettings.objects.get_or_create(pk=1)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(branches)} branches, {len(products)} products, "
                f"and {baskets} ready-made baskets with branch inventory."
            )
        )

    def seed_branches(self):
        branches = {}
        for data in BRANCHES:
            branch, _ = Branch.objects.update_or_create(
                slug=data["slug"],
                defaults={
                    **data,
                    "phone": "",
                    "opening_hours": PLACEHOLDER_HOURS,
                    "hours_are_placeholder": True,
                    "is_active": True,
                },
            )
            branches[branch.slug] = branch
        return branches

    def seed_products(self):
        categories = {}
        for index, slug in enumerate(CATEGORY_PRODUCTS):
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": slug.replace("-", " ").title(),
                    "display_order": index,
                    "is_active": True,
                },
            )
            categories[slug] = category

        tags = {
            slug: ProductTag.objects.update_or_create(
                slug=slug,
                defaults={"name": name},
            )[0]
            for slug, name in TAG_NAMES.items()
        }
        products = []
        index = 0
        for category_slug, entries in CATEGORY_PRODUCTS.items():
            for name, unit, unit_type, price_minor in entries:
                slug = name.lower().replace(" ", "-")
                img_info = PRODUCT_IMAGES.get(slug, ("", []))
                product, _ = Product.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "sku": f"FH-{slug.upper().replace('-', '-')}",
                        "category": categories[category_slug],
                        "name": name,
                        "description": "",
                        "unit": unit,
                        "unit_type": unit_type,
                        "base_price_minor": price_minor,
                        "image_url": img_info[0],
                        "gallery_image_urls": img_info[1],
                        "nutrition": {},
                        "origin": "",
                        "is_active": True,
                    },
                )
                assigned_tags = []
                if index % 5 == 0:
                    assigned_tags.append(tags["organic"])
                if index % 3 == 0:
                    assigned_tags.append(tags["in-season"])
                product.tags.set(assigned_tags)
                products.append(product)
                index += 1
        return products

    def seed_baskets(self, products, branches):
        products_by_slug = {product.slug: product for product in products}
        for index, data in enumerate(DEMO_BASKETS):
            category_slug, category_name = data["category"]
            category, _ = BasketCategory.objects.update_or_create(
                slug=category_slug,
                defaults={
                    "name": category_name,
                    "display_order": index,
                    "is_active": True,
                },
            )
            component_products = [
                (products_by_slug[slug], quantity)
                for slug, quantity in data["components"]
            ]
            price_minor = sum(
                product.base_price_minor * quantity
                for product, quantity in component_products
            )
            package, _ = BasketPackage.objects.update_or_create(
                sku=data["sku"],
                defaults={
                    "slug": data["slug"],
                    "name": data["name"],
                    "category": category,
                    "description": data["description"],
                    "base_price_minor": price_minor,
                    "image_url": "",
                    "is_placeholder": False,
                    "gift_message_allowed": False,
                    "is_active": True,
                },
            )
            component_product_ids = []
            for product, quantity in component_products:
                component_product_ids.append(product.pk)
                BasketComponent.objects.update_or_create(
                    basket_package=package,
                    product=product,
                    defaults={"quantity": quantity, "is_optional": False},
                )
                for branch in branches.values():
                    inventory, _ = ProductBranch.objects.get_or_create(
                        branch=branch,
                        product=product,
                    )
                    inventory.stock_on_hand = max(inventory.stock_on_hand, quantity)
                    inventory.is_available = True
                    inventory.save(update_fields=("stock_on_hand", "is_available", "updated_at"))
            package.components.exclude(product_id__in=component_product_ids).delete()
        return len(DEMO_BASKETS)

    def seed_inventory(self, branches, products):
        for branch_index, branch in enumerate(branches.values()):
            for product_index, product in enumerate(products):
                stock = (
                    0
                    if (product_index + branch_index * 2) % 7 == 0
                    else 250
                )
                is_available = stock > 0 and (product_index + branch_index) % 6 != 0
                override = (
                    product.base_price_minor + branch_index * 50
                    if (product_index + branch_index) % 4 == 0
                    else None
                )
                ProductBranch.objects.update_or_create(
                    branch=branch,
                    product=product,
                    defaults={
                        "stock_on_hand": stock,
                        "reserved_quantity": 0,
                        "is_available": is_available,
                        "price_override_minor": override,
                    },
                )

    def seed_test_users(self, password, branch):
        users = (
            ("demo-customer", "customer@farmershaus.test", "+233500000001", None, False),
            ("demo-staff", "staff@farmershaus.test", "+233500000002", BranchMembership.Role.STAFF, False),
            ("demo-manager", "manager@farmershaus.test", "+233500000003", BranchMembership.Role.MANAGER, False),
            ("demo-super-admin", "admin@farmershaus.test", "+233500000004", None, True),
        )
        for username, email, phone, membership_role, is_superuser in users:
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "phone": phone,
                    "display_name": username.replace("-", " ").title(),
                    "is_active": True,
                },
            )
            user.email = email
            user.phone = phone
            user.display_name = username.replace("-", " ").title()
            user.is_active = True
            user.is_staff = is_superuser
            user.is_superuser = is_superuser
            validate_password(password, user=user)
            user.set_password(password)
            user.save()
            if membership_role:
                BranchMembership.objects.update_or_create(
                    user=user,
                    branch=branch,
                    defaults={"role": membership_role, "is_active": True},
                )
            if username == "demo-customer":
                CustomerAddress.objects.update_or_create(
                    user=user,
                    defaults={
                        "recipient_name": "Ama Mensah",
                        "phone": "+233500000001",
                        "address_line_1": "House 12, Haatso-Atomic Road",
                        "address_line_2": "Near Supermarket Junction",
                        "area": "Dome / Haatso",
                        "directions": "Blue gate opposite the pharmacy",
                        "latitude": 5.6601,
                        "longitude": -0.2155,
                        "is_default": True,
                    },
                )

    def seed_delivery_zones(self, branches):
        for branch in branches.values():
            DeliveryZone.objects.update_or_create(
                branch=branch,
                name="Standard Local Delivery",
                defaults={
                    "area_description": f"Within 8 km radius of {branch.name}",
                    "delivery_fee_minor": 1500,
                    "minimum_order_minor": 0,
                    "is_active": True,
                },
            )
            DeliveryZone.objects.update_or_create(
                branch=branch,
                name="Express Same-Day Delivery",
                defaults={
                    "area_description": f"Priority express courier from {branch.name}",
                    "delivery_fee_minor": 2500,
                    "minimum_order_minor": 0,
                    "is_active": True,
                },
            )

    def seed_fulfillment_slots(self, branches):
        now = timezone.now()
        slot_windows = [
            (time(9, 0), time(12, 0)),
            (time(12, 0), time(15, 0)),
            (time(15, 0), time(18, 0)),
            (time(18, 0), time(21, 0)),
        ]
        for branch in branches.values():
            for day_offset in range(6):
                day_date = (now + timedelta(days=day_offset)).date()
                for start_t, end_t in slot_windows:
                    start_dt = timezone.make_aware(datetime.combine(day_date, start_t))
                    end_dt = timezone.make_aware(datetime.combine(day_date, end_t))
                    if start_dt <= now:
                        continue
                    for method in ["delivery", "pickup"]:
                        FulfillmentSlot.objects.update_or_create(
                            branch=branch,
                            method=method,
                            starts_at=start_dt,
                            ends_at=end_dt,
                            defaults={"capacity": 25, "is_active": True},
                        )
