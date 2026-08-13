BEGIN;
INSERT INTO public.order_statuses(code,label,sort_order,is_terminal) VALUES
 ('new','New',0,false),('awaiting_payment','Awaiting payment',1,false),('artwork_required','Artwork required',2,false),('artwork_received','Artwork received',3,false),('design_in_progress','Design in progress',4,false),('awaiting_customer_approval','Awaiting customer approval',5,false),('approved','Approved',6,false),('in_production','In production',7,false),('ready','Ready',8,false),('dispatched','Dispatched',9,false),('completed','Completed',10,true),('cancelled','Cancelled',11,true);
INSERT INTO public.quote_statuses(code,label,sort_order,is_terminal) VALUES ('submitted','Submitted',0,false),('reviewing','Reviewing',1,false),('quoted','Quoted',2,false),('accepted','Accepted',3,true),('declined','Declined',4,true),('expired','Expired',5,true),('cancelled','Cancelled',6,true);
INSERT INTO public.categories(name,slug,is_published,sort_order) VALUES
 ('Printing','printing',true,10),('Signage','signage',true,20),('Promotional / Display','promotional-display',true,30),('Apparel','apparel',true,40),('Décor','decor',true,50),('Design','design',true,60),('Digital Solutions','digital-solutions',true,70);
INSERT INTO public.categories(name,slug,parent_id,is_published,sort_order)
SELECT item.name,item.slug,c.id,true,item.sort_order FROM (VALUES
 ('Digital Printing','digital-printing','printing',10),('UV Printing','uv-printing','printing',20),('Sublimation Printing','sublimation-printing','printing',30),('Offset Printing','offset-printing','printing',40),
 ('2D Signage','2d-signage','signage',10),('3D Signage','3d-signage','signage',20),('Lightbox Signage','lightbox-signage','signage',30),('Pylon Signage','pylon-signage','signage',40),('Acrylic Signage','acrylic-signage','signage',50),
 ('Pull-up Banners','pull-up-banners','promotional-display',10),('Teardrops','teardrops','promotional-display',20),('Stickers','stickers','promotional-display',30),('Promotional Items','promotional-items','promotional-display',40),
 ('Branded T-shirts','branded-t-shirts','apparel',10),('Caps','caps','apparel',20),('Bucket Hats','bucket-hats','apparel',30),('Other Apparel','other-apparel','apparel',40),
 ('Canvas Wall Frames','canvas-wall-frames','decor',10),('Glass Wall Frames','glass-wall-frames','decor',20),('Acrylic Wall Frames','acrylic-wall-frames','decor',30),
 ('Graphics Designing','graphics-designing','design',10),('Website Design','website-design','digital-solutions',10),('E-commerce Website Development','ecommerce-website-development','digital-solutions',20),('Business Point-of-Sale Systems','business-point-of-sale-systems','digital-solutions',30)
) AS item(name,slug,parent_slug,sort_order) JOIN public.categories c ON c.slug=item.parent_slug;
INSERT INTO public.content_entries(section,entry_key,value,is_published) VALUES
 ('hero','default','{}',false),('featured_work','default','{}',false),('featured_categories','default','{}',false),('featured_products','default','{}',false),('announcement','default','{}',false),('contact','details','{}',false),('social','accounts','{}',false),('footer','default','{}',false),('business_hours','default','{}',false);
COMMIT;
