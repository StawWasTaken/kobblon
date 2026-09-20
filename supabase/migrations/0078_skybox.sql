-- It is a skybox.
--
-- The default sky in World Creator went up as "daylight-skyblox", and the
-- word has spread as far as its Catalog card and its link preview. Staw's
-- word is skybox, so the row is corrected here rather than in nine places
-- that read it.

update public.assets
   set name = replace(name, 'skyblox', 'skybox'),
       description = replace(description, 'skyblox', 'skybox')
 where name ilike '%skyblox%' or description ilike '%skyblox%';

update public.assets
   set name = replace(name, 'Skyblox', 'Skybox'),
       description = replace(description, 'Skyblox', 'Skybox')
 where name like '%Skyblox%' or description like '%Skyblox%';
